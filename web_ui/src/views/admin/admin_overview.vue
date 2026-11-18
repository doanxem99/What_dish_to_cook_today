<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import StatusProbe from '../../components/admin/status_probe.vue'
import JobTable from '../../components/admin/job_table.vue'

const { t } = useI18n()
const auth = useAuthStore()

const POLL_MS = 15000
const RECENT_JOBS = 5

const health = ref(null)
const healthError = ref(null)
const healthLoading = ref(false)
const checkedAt = ref('')
const jobs = ref([])
const jobsLoading = ref(true)
const jobsFailed = ref(false)
let timer = null

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

const probes = computed(() => {
  const data = health.value
  const failed = healthError.value !== null
  const probe = (label, state, value, action, note) => ({
    label,
    state: failed ? 'missing' : state,
    value,
    action: failed ? t('admin.statusFailedAction') : action,
    note: note || ''
  })
  if (!data) {
    return [
      probe(t('admin.probe.database'), 'checking', '', ''),
      probe(t('admin.probe.translation'), 'checking', '', ''),
      probe(t('admin.probe.ai'), 'checking', '', ''),
      probe(t('admin.probe.backup'), 'checking', '', '')
    ]
  }
  const database = data.database || {}
  const translation = data.translation || {}
  const backup = data.backup || {}
  return [
    probe(
      t('admin.probe.database'),
      database.ok ? 'ok' : 'missing',
      t('admin.probe.latency', { ms: database.latency_ms ?? 0 }),
      t('admin.probe.databaseAction'),
      database.error || ''
    ),
    probe(
      t('admin.probe.translation'),
      translation.ok ? 'ok' : 'missing',
      translation.ok ? t('admin.probe.languages', { n: translation.languages ?? 0 }) : t('admin.probe.failed'),
      t('admin.probe.translationAction'),
      translation.error || ''
    ),
    probe(
      t('admin.probe.ai'),
      data.ai && data.ai.configured ? 'ok' : 'partial',
      data.ai && data.ai.configured ? t('admin.probe.configured') : t('admin.probe.notConfigured'),
      '',
      ''
    ),
    probe(
      t('admin.probe.backup'),
      backup.dir_writable && !backup.error ? 'ok' : 'missing',
      backup.last
        ? t('admin.probe.lastBackup', { when: when(backup.last.created_at) })
        : t('admin.probe.noBackup'),
      t('admin.probe.backupAction'),
      backup.dir || backup.error || ''
    )
  ]
})

const counts = computed(() => {
  const source = (health.value && health.value.counts) || {}
  return [
    { key: 'users', value: source.users },
    { key: 'ingredients', value: source.ingredients },
    { key: 'dishes', value: source.dishes },
    { key: 'comments', value: source.comments }
  ].map(row => ({ ...row, label: t('admin.count.' + row.key) }))
})

const maintenance = computed(() => (health.value && health.value.maintenance) || null)

async function loadHealth() {
  healthLoading.value = true
  try {
    health.value = await adminApi.health()
    healthError.value = null
  } catch (error) {
    const status = (error && error.response && error.response.status) || null
    healthError.value = { status, message: (error && error.response && error.response.data && error.response.data.message) || '' }
    //A 401 means the session is gone: clear the stale account so the sign-in link is reachable.
    if (status === 401) {
      await auth.signOut()
    }
  } finally {
    healthLoading.value = false
    checkedAt.value = when(new Date().toISOString())
  }
}

async function loadJobs() {
  jobsLoading.value = jobs.value.length === 0
  try {
    const answer = await adminApi.jobs({ page: 1 })
    jobs.value = (answer && Array.isArray(answer.rows) ? answer.rows : []).slice(0, RECENT_JOBS)
    jobsFailed.value = false
  } catch (error) {
    jobsFailed.value = true
  } finally {
    jobsLoading.value = false
  }
}

//One timer: the hidden-tab check happens on every tick, and a return to the tab refreshes at once.
function tick() {
  if (!document.hidden) {
    loadHealth()
  }
}

function onVisible() {
  if (!document.hidden) {
    loadHealth()
  }
}

onMounted(() => {
  loadHealth()
  loadJobs()
  timer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="admin-overview">
    <p v-if="maintenance && maintenance.on" class="maintenance-banner" role="status">
      <strong>{{ t('admin.maintenance.title') }}</strong>
      <span>{{ maintenance.reason || t('admin.maintenance.unknown') }}</span>
      <span v-if="maintenance.updated_at" class="maintenance-at">
        {{ t('admin.maintenance.since', { when: when(maintenance.updated_at) }) }}
      </span>
    </p>

    <section aria-labelledby="admin-status-title">
      <div class="admin-section-head">
        <h2 id="admin-status-title" class="admin-section-title">{{ t('admin.status.title') }}</h2>
        <button
          class="btn btn-quiet admin-refresh"
          type="button"
          :disabled="healthLoading"
          @click="loadHealth"
        >{{ t('common.retry') }}</button>
      </div>
      <div class="ruled admin-probes">
        <StatusProbe
          v-for="probe in probes"
          :key="probe.label"
          :label="probe.label"
          :state="probe.state"
          :value="probe.value"
          :action="probe.action"
          :note="probe.note"
          :at="checkedAt"
        />
      </div>
      <div v-if="healthError" class="text-sm admin-failed" role="alert">
        <template v-if="healthError.status === 401">
          <p>{{ t('admin.status.signIn') }}</p>
          <router-link class="link" to="/signin">{{ t('admin.status.signInLink') }}</router-link>
        </template>
        <template v-else-if="healthError.status === 403">
          <p class="admin-failed-title">{{ t('admin.forbidden.title') }}</p>
          <p>{{ healthError.message || t('admin.forbidden.body') }}</p>
        </template>
        <p v-else>{{ t('admin.status.failed') }}</p>
      </div>
    </section>

    <section aria-labelledby="admin-counts-title">
      <h2 id="admin-counts-title" class="admin-section-title">{{ t('admin.counts.title') }}</h2>
      <dl class="ruled admin-counts">
        <div v-for="row in counts" :key="row.key" class="admin-count">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value === undefined || row.value === null ? '—' : row.value }}</dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="admin-recent-title">
      <div class="admin-section-head">
        <h2 id="admin-recent-title" class="admin-section-title">{{ t('admin.recent.title') }}</h2>
        <span class="admin-tab is-disabled admin-refresh" aria-disabled="true" :title="t('admin.nav.later')">{{ t('admin.recent.viewAll') }}</span>
      </div>
      <JobTable :rows="jobs" :loading="jobsLoading" :failed="jobsFailed" />
    </section>
  </div>
</template>

<style>
.admin-overview {
  display: grid;
  gap: var(--space-5);
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

.admin-refresh {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
}

.admin-refresh.is-disabled {
  cursor: not-allowed;
}

.admin-probes {
  padding: 0 var(--space-3);
}

.admin-failed {
  margin: var(--space-2) 0 0;
  color: var(--board-danger);
}

.admin-failed p {
  margin: 0 0 var(--space-1);
}

.admin-failed-title {
  font-weight: 700;
}

.maintenance-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-3);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--board-amber);
  border-radius: var(--radius);
  background: var(--board-raised);
  color: var(--board-amber);
  font-size: 13px;
}

.maintenance-at {
  color: var(--board-dim);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.admin-counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
}

.admin-count {
  padding: var(--space-3);
  border-right: 1px solid var(--board-line);
}

.admin-count:last-child {
  border-right: 0;
}

.admin-count dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--board-dim);
}

.admin-count dd {
  margin: var(--space-1) 0 0;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 639px) {
  .admin-counts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .admin-count:nth-child(2) {
    border-right: 0;
  }
  .admin-count:nth-child(-n + 2) {
    border-bottom: 1px solid var(--board-line);
  }
  .admin-probes {
    padding: 0 var(--space-2);
  }
  .probe {
    flex-wrap: wrap;
  }
  .probe-at {
    padding-left: 22px;
  }
}
</style>
