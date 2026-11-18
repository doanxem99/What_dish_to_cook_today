<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useI18n } from '../../i18n'
import StatusProbe from '../../components/admin/status_probe.vue'
import JobTable from '../../components/admin/job_table.vue'

const { t } = useI18n()

const RECENT_JOBS = 5

//The layout owns the single 15 s health poll; this view only renders its snapshot.
const { health, healthError, healthLoading, checkedAt, reload } = inject('adminHealth')

const jobs = ref([])
const jobsLoading = ref(true)
const jobsFailed = ref(false)

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
      translation.configured
        ? t('admin.probe.translationUnreachable')
        : t('admin.probe.translationAction'),
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

onMounted(loadJobs)
</script>

<template>
  <div class="admin-overview">
    <section aria-labelledby="admin-status-title">
      <div class="admin-section-head">
        <h2 id="admin-status-title" class="admin-section-title">{{ t('admin.status.title') }}</h2>
        <button
          class="btn btn-quiet admin-refresh"
          type="button"
          :disabled="healthLoading"
          @click="reload"
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
        <router-link class="link admin-refresh" to="/admin/jobs">{{ t('admin.recent.viewAll') }}</router-link>
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

.admin-refresh {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
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
