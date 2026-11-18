<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import AdminToast from '../../components/admin/admin_toast.vue'
import { errorKind, maintenanceReason } from '../../components/admin/admin_format.js'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const POLL_MS = 15000

const health = ref(null)
const healthError = ref(null)
const healthLoading = ref(false)
const checkedAt = ref('')
let timer = null

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

async function loadHealth() {
  healthLoading.value = true
  try {
    health.value = await adminApi.health()
    healthError.value = null
  } catch (error) {
    healthError.value = error
    //A 401 means the session is gone: clear the stale account so the sign-in link is reachable.
    if (errorKind(error) === 'unauthorized') {
      await auth.signOut()
    }
  } finally {
    healthLoading.value = false
    checkedAt.value = when(new Date().toISOString())
  }
}

//One poller for the whole admin area; Overview and the banner read the same snapshot.
provide('adminHealth', { health, healthError, healthLoading, checkedAt, reload: loadHealth })

const aiConfigured = computed(() => Boolean(health.value && health.value.ai && health.value.ai.configured))

const tabs = computed(() => [
  { path: '/admin', key: 'admin.nav.overview' },
  { path: '/admin/jobs', key: 'admin.nav.jobs' },
  { path: '/admin/backups', key: 'admin.nav.backups' },
  { path: '/admin/users', key: 'admin.nav.users' },
  ...(aiConfigured.value ? [{ path: '/admin/ai', key: 'admin.nav.ai' }] : []),
  { path: '/admin/audit', key: 'admin.nav.audit' }
])

const maintenance = computed(() => {
  const source = health.value && health.value.maintenance
  return source && source.on ? source : null
})

function shortId(value) {
  return String(value || '').slice(-6)
}

function tick() {
  if (!document.hidden && auth.isAdmin) {
    loadHealth()
  }
}

function onVisible() {
  if (!document.hidden && auth.isAdmin) {
    loadHealth()
  }
}

onMounted(() => {
  loadHealth()
  timer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <section class="board admin-page py-6">
    <div v-if="!auth.isAdmin && auth.isLogin" class="ruled admin-forbidden" role="alert">
      <h1 class="board-title">{{ t('admin.forbidden.title') }}</h1>
      <p class="measure">{{ t('admin.forbidden.body') }}</p>
      <router-link class="btn btn-primary" to="/">{{ t('admin.forbidden.home') }}</router-link>
    </div>

    <!--A 401 signs the user out: the sign-in link must stay reachable and return here.-->
    <div v-else-if="!auth.isAdmin" class="ruled admin-forbidden" role="alert">
      <h1 class="board-title">{{ t('admin.status.signInLink') }}</h1>
      <p class="measure">{{ t('admin.forbidden.signInBody') }}</p>
      <router-link class="btn btn-primary" to="/signin" @click="auth.jumpPage = route.fullPath">
        {{ t('admin.status.signInLink') }}
      </router-link>
    </div>

    <template v-else>
      <header class="admin-head">
        <h1 class="board-title">{{ t('admin.title') }}</h1>
        <p class="board-sub">{{ t('admin.subtitle') }}</p>
      </header>

      <nav class="admin-subnav" :aria-label="t('admin.nav.label')">
        <router-link
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          class="admin-tab"
          :class="{ 'is-active': route.path === tab.path }"
          :aria-current="route.path === tab.path ? 'page' : undefined"
        >{{ t(tab.key) }}</router-link>
      </nav>

      <p v-if="maintenance" class="maintenance-banner" role="status">
        <strong>{{ t('admin.maintenance.title') }}</strong>
        <span>{{ maintenanceReason(maintenance.reason, t) || t('admin.maintenance.unknown') }}</span>
        <span v-if="maintenance.job_id" class="maintenance-job">{{ t('admin.maintenance.job', { id: shortId(maintenance.job_id) }) }}</span>
        <span v-if="maintenance.updated_at" class="maintenance-at">
          {{ t('admin.maintenance.since', { when: when(maintenance.updated_at) }) }}
        </span>
        <router-link class="link" to="/admin/jobs">{{ t('admin.maintenance.open') }}</router-link>
      </p>

      <router-view />
    </template>

    <AdminToast v-if="auth.isAdmin" />
  </section>
</template>

<style>
.admin-page {
  padding-bottom: var(--space-6);
}

.admin-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  margin-bottom: var(--space-3);
}

.admin-head .board-sub {
  margin-top: 0;
  font-size: 13px;
}

.admin-subnav {
  display: flex;
  align-items: stretch;
  gap: var(--space-4);
  overflow-x: auto;
  border-bottom: 1px solid var(--board-line);
  margin-bottom: var(--space-5);
  scrollbar-width: none;
}

.admin-subnav::-webkit-scrollbar {
  display: none;
}

.admin-tab {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 2px;
  white-space: nowrap;
  font-size: 13px;
  color: var(--board-dim);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.admin-tab:hover {
  color: var(--board-ink);
}

.admin-tab:focus-visible {
  outline: 2px solid var(--board-amber);
  outline-offset: 2px;
}

.admin-tab.is-active {
  color: var(--board-amber);
  border-bottom-color: var(--board-amber);
  font-weight: 700;
}

.admin-forbidden {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-5);
  max-width: 62ch;
}

.admin-section-title {
  margin: 0 0 var(--space-2);
  font-size: 13px;
  font-weight: 700;
}

.admin-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.admin-section-head .admin-section-title {
  margin-bottom: 0;
}

.maintenance-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-3);
  margin: 0 0 var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--board-amber);
  border-radius: var(--radius);
  background: var(--board-raised);
  color: var(--board-amber);
  font-size: 13px;
}

.maintenance-job,
.maintenance-at {
  color: var(--board-dim);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/*Shared shell for the five operational views*/
.admin-view {
  display: grid;
  gap: var(--space-5);
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}

.admin-filter {
  flex: 0 1 200px;
  min-width: 150px;
}

.admin-search {
  flex: 1 1 240px;
  min-width: 0;
}

.admin-live {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 0 auto;
  font-size: 12px;
  color: var(--board-amber);
}

.admin-hint {
  margin: var(--space-1) 0 0;
  font-size: 12px;
  color: var(--board-dim);
}

.admin-failure {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  padding: var(--space-3);
  color: var(--board-danger);
  font-size: 13px;
}

.admin-failure p {
  margin: 0;
}

.admin-table-wrap {
  overflow: hidden;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.admin-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--board-dim);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--board-line-strong);
  white-space: nowrap;
}

.admin-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--board-line);
  vertical-align: top;
}

.admin-table tbody tr:last-child td {
  border-bottom: 0;
}

.admin-table .is-num {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--board-dim);
}

.admin-table .admin-actions-col {
  text-align: right;
}

.admin-file,
.admin-ellipsis {
  max-width: 26ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.admin-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.admin-pager-state {
  font-size: 12px;
  color: var(--board-dim);
  font-variant-numeric: tabular-nums;
}

.admin-danger {
  display: grid;
  gap: var(--space-3);
  border-top: 1px solid var(--board-line);
  padding-top: var(--space-4);
}

.admin-danger-title {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--board-danger);
}

.admin-danger-copy,
.admin-danger-note {
  margin: 0;
  font-size: 13px;
  color: var(--board-dim);
}

.admin-danger-note {
  color: var(--board-danger);
}

.admin-danger-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.admin-danger-pick {
  flex: 1 1 280px;
  min-width: 0;
}

.admin-danger-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.btn-danger {
  border-color: var(--board-danger);
  color: var(--board-danger);
}

.btn-danger:hover:not([disabled]) {
  background: var(--board-danger);
  border-color: var(--board-danger);
  color: var(--board-bg);
}

.admin-job-result {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-3);
  margin: 0;
  font-size: 13px;
  color: var(--board-green);
}

.admin-job-result.is-error {
  color: var(--board-danger);
}

.admin-job-detail {
  font-size: 12px;
  color: var(--board-dim);
  overflow-wrap: anywhere;
}

.admin-password-value {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--board-line-strong);
  border-radius: var(--radius);
  background: var(--board-bg);
}

.admin-password-value code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  overflow-wrap: anywhere;
}

@media (max-width: 639px) {
  .admin-page {
    padding-top: var(--space-3);
  }
  .admin-subnav {
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .admin-filter {
    flex: 1 1 100%;
    min-width: 0;
  }
  .admin-live {
    margin-left: 0;
  }
  .admin-table thead {
    display: none;
  }
  .admin-table,
  .admin-table tbody,
  .admin-table tr,
  .admin-table td {
    display: block;
    width: 100%;
  }
  .admin-table tr {
    padding: var(--space-2);
    border-bottom: 1px solid var(--board-line);
  }
  .admin-table tbody tr:last-child {
    border-bottom: 0;
  }
  .admin-table td {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: 2px 0;
    border-bottom: 0;
  }
  .admin-table td::before {
    content: attr(data-label);
    flex: 0 0 6.5em;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--board-dim);
  }
  .admin-table .admin-actions-col {
    text-align: left;
  }
  .admin-file,
  .admin-ellipsis {
    max-width: none;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .admin-pager {
    justify-content: space-between;
  }
  .admin-danger-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
