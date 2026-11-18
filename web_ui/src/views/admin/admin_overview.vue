<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useI18n } from '../../i18n'
import StatusProbe from '../../components/admin/status_probe.vue'
import JobTable from '../../components/admin/job_table.vue'
import { countLine, errorKind, sortProbes } from '../../components/admin/admin_format.js'

const { t } = useI18n()

const RECENT_JOBS = 5

//The layout owns the single 15 s health poll; this view only renders its snapshot.
const { health, healthError, healthLoading, checkedAt, failedAt, reload } = inject('adminHealth')

const jobs = ref([])
const jobsLoading = ref(true)
const jobsFailed = ref(false)

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

//A failed poll leaves the last good snapshot in place and marks it stale.
const stale = computed(() => healthError.value !== null && health.value !== null)
const failureKind = computed(() => errorKind(healthError.value))

const probes = computed(() => {
  const data = health.value
  const probe = (label, state, value, action, note) => ({ label, state, value, action, note: note || '' })
  if (!data) {
    //A first load that fails ends in the failure row, not four rows stuck on "Checking".
    if (healthError.value) {
      return []
    }
    return [
      probe(t('admin.probe.database'), 'checking', '', '', ''),
      probe(t('admin.probe.translation'), 'checking', '', '', ''),
      probe(t('admin.probe.ai'), 'checking', '', '', ''),
      probe(t('admin.probe.backup'), 'checking', '', '', '')
    ]
  }
  const database = data.database || {}
  const translation = data.translation || {}
  const backup = data.backup || {}
  return sortProbes([
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
  ])
})

const countsText = computed(() => countLine(health.value && health.value.counts, t))

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
        <div class="admin-status-head-actions">
          <p v-if="checkedAt" class="admin-checked">
            {{ stale
              ? t('admin.status.stale', { good: checkedAt, failed: failedAt })
              : t('admin.probe.at', { when: checkedAt }) }}
          </p>
          <button
            class="btn btn-quiet admin-refresh"
            type="button"
            :disabled="healthLoading"
            @click="reload"
          >{{ t('admin.strip.checkNow') }}</button>
        </div>
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
          :stale="stale"
        />
        <!--One row for the failed read: the retry lives here, not on four fake outages.-->
        <div v-if="healthError" class="admin-probe-failure" role="alert">
          <template v-if="failureKind === 'unauthorized'">
            <p>{{ t('admin.status.signIn') }}</p>
            <router-link class="link" to="/signin">{{ t('admin.status.signInLink') }}</router-link>
          </template>
          <template v-else-if="failureKind === 'forbidden'">
            <p class="admin-failed-title">{{ t('admin.forbidden.title') }}</p>
            <p>{{ healthError.message || t('admin.forbidden.body') }}</p>
          </template>
          <template v-else>
            <p>{{ t('admin.status.failed') }}</p>
            <button class="btn" type="button" :disabled="healthLoading" @click="reload">
              {{ t('admin.common.retry') }}
            </button>
          </template>
        </div>
      </div>
    </section>

    <section aria-labelledby="admin-counts-title">
      <h2 id="admin-counts-title" class="admin-section-title">{{ t('admin.counts.title') }}</h2>
      <p class="ruled admin-counts">{{ countsText || '—' }}</p>
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

.admin-status-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--space-1) var(--space-3);
}

.admin-checked {
  margin: 0;
  font-size: 11px;
  color: var(--board-dim);
  font-variant-numeric: tabular-nums;
}

.admin-probes {
  padding: 0 var(--space-3);
}

.admin-probe-failure {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  padding: var(--space-3) 0;
  color: var(--board-danger);
  font-size: 13px;
}

.admin-probe-failure p {
  margin: 0;
}

.admin-failed-title {
  font-weight: 700;
}

.admin-counts {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--board-ink);
}

@media (max-width: 639px) {
  .admin-probes {
    padding: 0 var(--space-2);
  }
  .probe {
    flex-wrap: wrap;
  }
}
</style>
