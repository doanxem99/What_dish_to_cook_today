<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import serverInfo from '../../assets/js/server_info.js'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import ConfirmDialog from '../../components/admin/confirm_dialog.vue'
import { errorKind, formatBytes } from '../../components/admin/admin_format.js'
import { notify } from '../../components/admin/admin_toast.js'

const { t } = useI18n()
const auth = useAuthStore()

const POLL_MS = 2000

const rows = ref([])
const loading = ref(true)
const error = ref(null)
const creating = ref(false)
const busyJob = ref(null)
const result = ref(null)
const note = ref('')
const dialog = ref('')
const dialogBusy = ref(false)
const dialogError = ref('')
const selectedId = ref('')

const selected = computed(() => rows.value.find(row => row.id === selectedId.value) || null)
const busy = computed(() => busyJob.value !== null)
const dialogWord = computed(() => (dialog.value === 'restore' ? 'RESTORE' : 'RESET'))

//A destructive job reports the file it wrote; the id is the download endpoint's key.
const writtenBackup = computed(() => {
  const detail = (result.value && result.value.detail) || ''
  if (!detail) {
    return null
  }
  return rows.value.find(row => detail.includes(row.file)) || null
})

const failure = computed(() => {
  const kind = errorKind(error.value)
  if (kind === 'unauthorized') return t('admin.status.signIn')
  if (kind === 'forbidden') return t('admin.forbidden.body')
  if (kind === 'server') return t('admin.request.server')
  return t('admin.backups.error')
})

const restoreBody = computed(() => (selected.value
  ? t('admin.backups.restoreBody', {
    file: selected.value.file,
    when: when(selected.value.created_at)
  })
  : t('admin.backups.restoreNone')))

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

async function load(quiet = false) {
  if (!quiet) {
    loading.value = rows.value.length === 0
  }
  try {
    const answer = await adminApi.backups()
    rows.value = answer && Array.isArray(answer.rows) ? answer.rows : []
    error.value = null
    if (!selected.value && rows.value.length > 0) {
      selectedId.value = rows.value[0].id
    }
  } catch (caught) {
    error.value = caught
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    }
  } finally {
    loading.value = false
  }
}

//One poll: the newest page holds a job created seconds ago; a finished row stops the timer.
let timer = null
//A job pushed off page 1 by newer rows is gone; three misses mean the poll can stop.
const MISSES_TO_STOP = 3
let misses = 0
//A 2 s interval can fire before a slow read lands; one request at a time keeps the misses honest.
let polling = false

function stopPoll() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function watchJob(job) {
  busyJob.value = job
  result.value = null
  misses = 0
  stopPoll()
  timer = setInterval(pollJob, POLL_MS)
}

async function pollJob() {
  const job = busyJob.value
  if (!job || document.hidden || polling) {
    return
  }
  polling = true
  try {
    const answer = await adminApi.jobs({ page: 1 })
    const found = (answer && Array.isArray(answer.rows) ? answer.rows : [])
      .find(row => String(row._id || row.id) === String(job._id || job.id))
    if (!found) {
      misses += 1
      if (misses >= MISSES_TO_STOP) {
        stopPoll()
        busyJob.value = null
      }
      return
    }
    misses = 0
    if (found.status === 'queued' || found.status === 'running') {
      return
    }
    stopPoll()
    busyJob.value = null
    result.value = found
    note.value = ''
    await load(true)
    notify(
      found.status === 'done' ? t('admin.backups.finished') : t('admin.backups.jobFailed', { error: found.error || '' }),
      found.status === 'done' ? 'ok' : 'error'
    )
  } catch (caught) {
    //A read that keeps failing would poll forever; the job row is still readable on the jobs page.
    stopPoll()
    busyJob.value = null
  } finally {
    polling = false
  }
}

//A page reload during a job must still lock the destructive buttons and show the progress.
async function detectBusy() {
  try {
    const answer = await adminApi.jobs({ page: 1 })
    const active = (answer && Array.isArray(answer.rows) ? answer.rows : [])
      .find(row => row.status === 'queued' || row.status === 'running')
    if (active) {
      watchJob(active)
    }
  } catch (caught) {
    //The buttons still answer 409; this check only saves a round trip.
  }
}

async function createBackup() {
  creating.value = true
  note.value = ''
  try {
    const job = await adminApi.backup()
    notify(t('admin.backups.queued'))
    watchJob(job)
  } catch (caught) {
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
      return
    }
    notify(t('admin.backups.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}

function openDialog(kind) {
  dialogError.value = ''
  dialog.value = kind
}

function closeDialog() {
  dialog.value = ''
  dialogError.value = ''
}

async function submitDialog() {
  const kind = dialog.value
  if (!kind) {
    return
  }
  dialogBusy.value = true
  dialogError.value = ''
  try {
    const job = kind === 'restore'
      ? await adminApi.restore(selectedId.value, dialogWord.value)
      : await adminApi.reset(dialogWord.value)
    closeDialog()
    note.value = ''
    notify(t('admin.backups.queued'))
    watchJob(job)
  } catch (caught) {
    const failureKind = errorKind(caught)
    if (failureKind === 'conflict') {
      closeDialog()
      note.value = t('admin.backups.busy')
      detectBusy()
    } else if (failureKind === 'unauthorized') {
      closeDialog()
      await auth.signOut()
    } else {
      dialogError.value = failureKind === 'server' ? t('admin.request.server') : t('admin.backups.actionFailed')
    }
  } finally {
    dialogBusy.value = false
  }
}

async function download(row) {
  try {
    const response = await fetch(
      serverInfo.serverUrl + 'api/admin/backups/' + encodeURIComponent(row.id),
      { credentials: 'include' }
    )
    if (!response.ok) {
      throw { status: response.status }
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = row.file
    document.body.appendChild(link)
    link.click()
    link.remove()
    //Revoking in the same tick can cancel the download in some browsers; let it start first.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (caught) {
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    }
    notify(t('admin.backups.downloadFailed'), 'error')
  }
}

onMounted(() => {
  load()
  detectBusy()
})
onBeforeUnmount(stopPoll)
</script>

<template>
  <div class="admin-view">
    <section aria-labelledby="admin-backups-title">
      <div class="admin-section-head">
        <h2 id="admin-backups-title" class="admin-section-title">{{ t('admin.backups.listTitle') }}</h2>
        <button class="btn" type="button" :disabled="creating" @click="createBackup">
          {{ creating ? t('admin.backups.creating') : t('admin.backups.create') }}
        </button>
      </div>

      <p v-if="busy" class="admin-live" role="status">
        <span class="lamp partial" aria-hidden="true"></span>
        {{ t('admin.backups.queuedNote') }}
        <router-link class="link" to="/admin/jobs">{{ t('admin.backups.jobLink') }}</router-link>
      </p>

      <p v-if="result" class="admin-job-result" :class="{ 'is-error': result.status === 'failed' }" role="status">
        <span>
          {{ result.status === 'done'
            ? t('admin.backups.finished')
            : t('admin.backups.jobFailed', { error: result.error || '' }) }}
        </span>
        <span v-if="result.detail" class="admin-job-detail">{{ result.detail }}</span>
        <router-link class="link" to="/admin/jobs">{{ t('admin.backups.jobLink') }}</router-link>
        <button
          v-if="writtenBackup"
          class="btn"
          type="button"
          @click="download(writtenBackup)"
        >{{ t('admin.backups.downloadBackup') }}</button>
      </p>

      <div v-if="error" class="ruled admin-failure" role="alert">
        <p>{{ failure }}</p>
        <router-link v-if="errorKind(error) === 'unauthorized'" class="link" to="/signin">
          {{ t('admin.status.signInLink') }}
        </router-link>
        <router-link v-else-if="errorKind(error) === 'forbidden'" class="link" to="/">
          {{ t('admin.forbidden.home') }}
        </router-link>
        <button v-else class="btn" type="button" @click="load()">{{ t('admin.common.retry') }}</button>
      </div>

      <div v-else class="ruled admin-table-wrap">
        <p v-if="loading" class="state text-sm">{{ t('admin.backups.loading') }}</p>
        <p v-else-if="rows.length === 0" class="state text-sm">{{ t('admin.backups.empty') }}</p>
        <table v-else class="admin-table">
          <caption class="sr-only">{{ t('admin.backups.listTitle') }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('admin.backups.createdAt') }}</th>
              <th scope="col">{{ t('admin.backups.file') }}</th>
              <th scope="col" class="is-num">{{ t('admin.backups.size') }}</th>
              <th scope="col" class="admin-actions-col">{{ t('admin.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="is-num" :data-label="t('admin.backups.createdAt')">{{ when(row.created_at) }}</td>
              <td class="admin-file" :data-label="t('admin.backups.file')" :title="row.file">{{ row.file }}</td>
              <td class="is-num" :data-label="t('admin.backups.size')">{{ formatBytes(row.bytes) }}</td>
              <td class="admin-actions-col" :data-label="t('admin.common.actions')">
                <button class="btn" type="button" @click="download(row)">{{ t('admin.backups.download') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-danger" aria-labelledby="admin-danger-title">
      <h2 id="admin-danger-title" class="admin-danger-title">{{ t('admin.backups.dangerTitle') }}</h2>
      <p class="admin-danger-copy measure">{{ t('admin.backups.dangerBody') }}</p>

      <p v-if="note" class="admin-danger-note" role="alert">
        {{ note }}
        <router-link class="link" to="/admin/jobs">{{ t('admin.backups.jobLink') }}</router-link>
      </p>

      <div class="admin-danger-actions">
        <div class="admin-danger-pick">
          <label class="field" for="admin-restore-select">
            <span class="eyebrow">{{ t('admin.backups.restoreSelect') }}</span>
            <select
              id="admin-restore-select"
              v-model="selectedId"
              class="input"
              :disabled="rows.length === 0 || busy"
            >
              <option v-for="row in rows" :key="row.id" :value="row.id">
                {{ row.file }} · {{ formatBytes(row.bytes) }}
              </option>
            </select>
          </label>
          <p class="admin-hint measure">{{ t('admin.backups.restoreHelp') }}</p>
        </div>
        <div class="admin-danger-buttons">
          <button
            class="btn btn-danger"
            type="button"
            :disabled="!selectedId || busy"
            @click="openDialog('restore')"
          >{{ t('admin.backups.restore') }}</button>
          <button
            class="btn btn-danger"
            type="button"
            :disabled="busy"
            @click="openDialog('reset')"
          >{{ t('admin.backups.reset') }}</button>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :open="dialog !== ''"
      :title="dialog === 'restore' ? t('admin.backups.restoreTitle') : t('admin.backups.resetTitle')"
      :body="dialog === 'restore' ? restoreBody : t('admin.backups.resetBody')"
      :word="dialogWord"
      :confirm-label="dialog === 'restore' ? t('admin.backups.restore') : t('admin.backups.reset')"
      :busy="dialogBusy"
      :error="dialogError"
      @close="closeDialog"
      @confirm="submitDialog"
    />
  </div>
</template>
