<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import ConfirmDialog from '../../components/admin/confirm_dialog.vue'
import UserRow from '../../components/admin/user_row.vue'
import { errorKind, filterQuery } from '../../components/admin/admin_format.js'
import { notify } from '../../components/admin/admin_toast.js'

const { t } = useI18n()
const auth = useAuthStore()

const PAGE_SIZE = 25

const q = ref('')
const query = ref('')
const page = ref(1)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref(null)
const rowErrors = ref({})
const busyId = ref('')
const confirmAction = ref(null)
const confirmBusy = ref(false)
const confirmError = ref('')
const password = ref(null)
const passwordDialog = ref(null)

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const me = computed(() => ({
  id: (auth.user && auth.user.id) || '',
  username: (auth.user && auth.user.username) || ''
}))

//The last-admin guard needs the whole listing; a search or a later page hides that fact.
const enabledAdmins = computed(() => {
  if (query.value || total.value > PAGE_SIZE) {
    return null
  }
  return rows.value.filter(row => (row.roles || []).includes('admin') && row.is_disabled !== true).length
})

const failure = computed(() => {
  const kind = errorKind(error.value)
  if (kind === 'unauthorized') return t('admin.status.signIn')
  if (kind === 'forbidden') return t('admin.forbidden.body')
  if (kind === 'server') return t('admin.request.server')
  return t('admin.users.error')
})

const confirmTitle = computed(() => {
  const action = confirmAction.value
  if (!action) return ''
  const name = action.row.username
  if (action.kind === 'role') {
    return action.admin ? t('admin.users.promoteTitle', { name }) : t('admin.users.demoteTitle', { name })
  }
  return action.disabled ? t('admin.users.disableTitle', { name }) : t('admin.users.enableTitle', { name })
})

const confirmBody = computed(() => {
  const action = confirmAction.value
  if (!action) return ''
  if (action.kind === 'role') {
    return action.admin ? t('admin.users.promoteBody') : t('admin.users.demoteBody')
  }
  return action.disabled ? t('admin.users.disableBody') : t('admin.users.enableBody')
})

const confirmLabel = computed(() => {
  const action = confirmAction.value
  if (!action) return t('admin.common.confirm')
  if (action.kind === 'role') {
    return action.admin ? t('admin.users.promote') : t('admin.users.demote')
  }
  return action.disabled ? t('admin.users.disable') : t('admin.users.enable')
})

async function load() {
  loading.value = rows.value.length === 0
  try {
    const answer = await adminApi.users(filterQuery({ q: query.value, page: page.value }))
    rows.value = answer && Array.isArray(answer.rows) ? answer.rows : []
    total.value = answer && Number.isFinite(answer.total) ? answer.total : 0
    error.value = null
  } catch (caught) {
    error.value = caught
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    }
  } finally {
    loading.value = false
  }
}

function search() {
  query.value = q.value.trim()
  page.value = 1
  rowErrors.value = {}
  load()
}

function go(next) {
  page.value = Math.min(pages.value, Math.max(1, next))
  load()
}

function replaceRow(updated) {
  if (!updated || !updated.id) {
    return
  }
  rows.value = rows.value.map(row => (row.id === updated.id ? updated : row))
}

function setRowError(id, text) {
  rowErrors.value = { ...rowErrors.value, [id]: text }
}

function clearRowError(id) {
  if (rowErrors.value[id]) {
    rowErrors.value = { ...rowErrors.value, [id]: '' }
  }
}

function askRole(row, admin) {
  confirmError.value = ''
  confirmAction.value = { kind: 'role', row, admin }
}

function askDisabled(row, disabled) {
  confirmError.value = ''
  confirmAction.value = { kind: 'disabled', row, disabled }
}

function closeConfirm() {
  confirmAction.value = null
  confirmError.value = ''
}

//The 409 codes are the server's; the row names the conflict in the reader's language.
function conflictText(caught) {
  const code = caught && caught.data && caught.data.error && caught.data.error.code
  if (code === 'self') {
    return t('admin.users.conflictSelf')
  }
  if (code === 'last_admin') {
    return t('admin.users.conflictLastAdmin')
  }
  return t('admin.users.conflictOther')
}

async function submitConfirm() {
  const action = confirmAction.value
  if (!action) {
    return
  }
  confirmBusy.value = true
  confirmError.value = ''
  try {
    const updated = action.kind === 'role'
      ? await adminApi.setRole(action.row.id, action.admin)
      : await adminApi.setDisabled(action.row.id, action.disabled)
    replaceRow(updated)
    clearRowError(action.row.id)
    notify(t('admin.users.saved'))
    closeConfirm()
  } catch (caught) {
    const kind = errorKind(caught)
    if (kind === 'conflict') {
      setRowError(action.row.id, conflictText(caught))
      closeConfirm()
    } else if (kind === 'unauthorized') {
      closeConfirm()
      await auth.signOut()
    } else {
      confirmError.value = kind === 'server' ? t('admin.request.server') : t('admin.users.saveFailed')
    }
  } finally {
    confirmBusy.value = false
  }
}

async function issuePassword(row) {
  busyId.value = row.id
  try {
    const answer = await adminApi.temporaryPassword(row.id)
    replaceRow(answer && answer.user)
    clearRowError(row.id)
    password.value = { username: row.username, value: (answer && answer.password) || '' }
    notify(t('admin.users.passwordIssued'))
  } catch (caught) {
    const kind = errorKind(caught)
    if (kind === 'conflict') {
      setRowError(row.id, conflictText(caught))
    } else if (kind === 'unauthorized') {
      await auth.signOut()
    } else {
      notify(t('admin.users.passwordFailed'), 'error')
    }
  } finally {
    busyId.value = ''
  }
}

//Closing drops the value: the password is shown once and never stored.
function closePassword() {
  password.value = null
}

async function copyPassword() {
  const value = password.value && password.value.value
  if (!value) {
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    notify(t('admin.users.copied'))
  } catch (caught) {
    notify(t('admin.users.copyFailed'), 'error')
  }
}

watch(password, async (value) => {
  await nextTick()
  const dialog = passwordDialog.value
  if (!dialog) {
    return
  }
  if (value && !dialog.open) {
    dialog.showModal()
  }
  if (!value && dialog.open) {
    dialog.close()
  }
})

onMounted(load)
</script>

<template>
  <div class="admin-view">
    <form class="admin-toolbar" role="search" @submit.prevent="search">
      <label class="field admin-search">
        <span class="eyebrow">{{ t('admin.users.search') }}</span>
        <input
          v-model="q"
          class="input"
          type="search"
          :placeholder="t('admin.users.searchPlaceholder')"
        />
      </label>
      <button class="btn" type="submit">{{ t('admin.common.apply') }}</button>
    </form>

    <div v-if="error" class="ruled admin-failure" role="alert">
      <p>{{ failure }}</p>
      <router-link v-if="errorKind(error) === 'unauthorized'" class="link" to="/signin">
        {{ t('admin.status.signInLink') }}
      </router-link>
      <router-link v-else-if="errorKind(error) === 'forbidden'" class="link" to="/">
        {{ t('admin.forbidden.home') }}
      </router-link>
      <button v-else class="btn" type="button" @click="load">{{ t('admin.common.retry') }}</button>
    </div>

    <div v-else class="ruled admin-table-wrap">
      <p v-if="loading" class="state text-sm">{{ t('admin.users.loading') }}</p>
      <p v-else-if="rows.length === 0" class="state text-sm">{{ t('admin.users.empty') }}</p>
      <table v-else class="admin-table admin-users-table">
        <caption class="sr-only">{{ t('admin.nav.users') }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.users.username') }}</th>
            <th scope="col">{{ t('admin.users.email') }}</th>
            <th scope="col">{{ t('admin.users.role') }}</th>
            <th scope="col">{{ t('admin.users.status') }}</th>
            <th scope="col">{{ t('admin.users.joined') }}</th>
            <th scope="col" class="admin-actions-col">{{ t('admin.common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <UserRow
            v-for="row in rows"
            :key="row.id"
            :row="row"
            :me="me"
            :enabled-admins="enabledAdmins"
            :busy="busyId === row.id"
            :error="rowErrors[row.id] || ''"
            @role="askRole"
            @disabled="askDisabled"
            @password="issuePassword"
          />
        </tbody>
      </table>
    </div>

    <nav v-if="total > PAGE_SIZE" class="admin-pager" :aria-label="t('admin.common.page', { page, pages })">
      <button class="btn" type="button" :disabled="page <= 1 || loading" @click="go(page - 1)">
        {{ t('admin.common.prev') }}
      </button>
      <span class="admin-pager-state">{{ t('admin.common.page', { page, pages }) }}</span>
      <button class="btn" type="button" :disabled="page >= pages || loading" @click="go(page + 1)">
        {{ t('admin.common.next') }}
      </button>
    </nav>

    <ConfirmDialog
      :open="confirmAction !== null"
      :title="confirmTitle"
      :body="confirmBody"
      :confirm-label="confirmLabel"
      :busy="confirmBusy"
      :error="confirmError"
      @close="closeConfirm"
      @confirm="submitConfirm"
    />

    <dialog
      ref="passwordDialog"
      class="admin-dialog"
      :aria-label="t('admin.users.password')"
      @cancel.prevent="closePassword"
      @close="closePassword"
    >
      <div class="admin-dialog-body">
        <h2 class="admin-dialog-title">
          {{ t('admin.users.passwordTitle', { name: password ? password.username : '' }) }}
        </h2>
        <p class="admin-dialog-copy measure">{{ t('admin.users.passwordBody') }}</p>
        <p class="admin-password-value"><code>{{ password ? password.value : '' }}</code></p>
        <p class="admin-dialog-hint">{{ t('admin.users.passwordOnce') }}</p>
        <div class="admin-dialog-actions">
          <button class="btn" type="button" @click="copyPassword">{{ t('admin.users.copy') }}</button>
          <button class="btn btn-primary" type="button" @click="closePassword">{{ t('admin.common.close') }}</button>
        </div>
      </div>
    </dialog>
  </div>
</template>
