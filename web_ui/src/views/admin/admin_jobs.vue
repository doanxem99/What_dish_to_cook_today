<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import JobTable from '../../components/admin/job_table.vue'
import {
  JOB_STATUSES,
  JOB_TYPES,
  errorKind,
  filterQuery,
  hasActiveJobs
} from '../../components/admin/admin_format.js'
import { notify } from '../../components/admin/admin_toast.js'

const { t } = useI18n()
const auth = useAuthStore()

const PAGE_SIZE = 25
const POLL_MS = 2000

const filters = ref({ type: '', status: '' })
const page = ref(1)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref(null)

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const active = computed(() => hasActiveJobs(rows.value))
const failure = computed(() => {
  const kind = errorKind(error.value)
  if (kind === 'unauthorized') return t('admin.status.signIn')
  if (kind === 'forbidden') return t('admin.forbidden.body')
  if (kind === 'server') return t('admin.request.server')
  return t('admin.jobs.error')
})

const failureKind = computed(() => errorKind(error.value))
//A polled read must not overlap the next tick, or two answers can land out of order.
let inFlight = false

async function load(quiet = false) {
  if (!quiet) {
    loading.value = rows.value.length === 0
  }
  inFlight = true
  try {
    const answer = await adminApi.jobs(filterQuery({
      type: filters.value.type,
      status: filters.value.status,
      page: page.value
    }))
    rows.value = answer && Array.isArray(answer.rows) ? answer.rows : []
    total.value = answer && Number.isFinite(answer.total) ? answer.total : 0
    error.value = null
    //A poll can empty the last page after a prune; step back instead of showing nothing.
    if (rows.value.length === 0 && page.value > pages.value) {
      page.value = pages.value
      await load(true)
    }
    //A successful retry after a stopped poll must start the live updates again.
    syncPoll()
  } catch (caught) {
    error.value = caught
    //A failed poll would retry forever; the panel offers the next step instead.
    stopPoll()
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    }
  } finally {
    inFlight = false
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function go(next) {
  page.value = Math.min(pages.value, Math.max(1, next))
  load()
}

async function retry(row) {
  const ingredientId = row && row.payload && row.payload.ingredient_id
  if (!ingredientId) {
    notify(t('admin.jobs.retryMissing'), 'error')
    return
  }
  try {
    await adminApi.recalcBestPost(ingredientId)
    notify(t('admin.jobs.retryQueued'))
    page.value = 1
    await load()
  } catch (caught) {
    notify(t('admin.jobs.retryFailed'), 'error')
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    }
  }
}

//One timer while a queued or running row is on screen; the hidden tab pauses it.
let timer = null

function stopPoll() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function syncPoll() {
  if (active.value && !timer) {
    timer = setInterval(() => {
      if (!document.hidden && !inFlight) load(true)
    }, POLL_MS)
  }
  if (!active.value) {
    stopPoll()
  }
}

function onVisible() {
  if (!document.hidden && active.value) {
    load(true)
  }
}

watch(active, syncPoll)

onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  stopPoll()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="admin-view">
    <div class="admin-toolbar">
      <label class="field admin-filter">
        <span class="eyebrow">{{ t('admin.jobs.type') }}</span>
        <select v-model="filters.type" class="input" @change="applyFilters">
          <option value="">{{ t('admin.common.all') }}</option>
          <option v-for="type in JOB_TYPES" :key="type" :value="type">{{ t('admin.job.type.' + type) }}</option>
        </select>
      </label>
      <label class="field admin-filter">
        <span class="eyebrow">{{ t('admin.jobs.status') }}</span>
        <select v-model="filters.status" class="input" @change="applyFilters">
          <option value="">{{ t('admin.common.all') }}</option>
          <option v-for="status in JOB_STATUSES" :key="status" :value="status">{{ t('admin.job.status.' + status) }}</option>
        </select>
      </label>
      <p v-if="active" class="admin-live" role="status">
        <span class="lamp partial" aria-hidden="true"></span>
        {{ t('admin.jobs.live') }}
      </p>
    </div>

    <div v-if="error" class="ruled admin-failure" role="alert">
      <p>{{ failure }}</p>
      <router-link v-if="failureKind === 'unauthorized'" class="link" to="/signin">
        {{ t('admin.status.signInLink') }}
      </router-link>
      <router-link v-else-if="failureKind === 'forbidden'" class="link" to="/">
        {{ t('admin.forbidden.home') }}
      </router-link>
      <button v-else class="btn" type="button" @click="load()">{{ t('admin.common.retry') }}</button>
    </div>

    <JobTable
      v-if="!error"
      :rows="rows"
      :loading="loading"
      :failed="false"
      :show-detail="true"
      :expandable="true"
      :retryable="true"
      :empty-key="filters.type || filters.status ? 'admin.jobs.emptyFiltered' : 'admin.jobs.empty'"
      caption-key="admin.nav.jobs"
      @retry="retry"
    />

    <nav v-if="total > PAGE_SIZE" class="admin-pager" :aria-label="t('admin.common.page', { page, pages })">
      <button class="btn" type="button" :disabled="page <= 1 || loading" @click="go(page - 1)">
        {{ t('admin.common.prev') }}
      </button>
      <span class="admin-pager-state">{{ t('admin.common.page', { page, pages }) }}</span>
      <button class="btn" type="button" :disabled="page >= pages || loading" @click="go(page + 1)">
        {{ t('admin.common.next') }}
      </button>
    </nav>
  </div>
</template>
