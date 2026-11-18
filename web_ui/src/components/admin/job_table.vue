<script setup>
import { useI18n } from '../../i18n'

const { t } = useI18n()

defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false }
})

//Server values stay readable when a newer type or status appears before the catalogue catches up.
const typeKeys = {
  backup: 'admin.job.type.backup',
  reset: 'admin.job.type.reset',
  restore: 'admin.job.type.restore',
  recalc_best_post: 'admin.job.type.recalc_best_post'
}
const statusKeys = {
  queued: 'admin.job.status.queued',
  running: 'admin.job.status.running',
  done: 'admin.job.status.done',
  failed: 'admin.job.status.failed'
}

const typeLabel = value => (typeKeys[value] ? t(typeKeys[value]) : value || t('common.unknown'))
const statusLabel = value => (statusKeys[value] ? t(statusKeys[value]) : value || t('common.unknown'))

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}
</script>

<template>
  <div class="ruled job-table">
    <p v-if="loading" class="state text-sm">{{ t('admin.jobs.loading') }}</p>
    <p v-else-if="failed" class="state text-sm" role="alert">{{ t('admin.jobs.error') }}</p>
    <p v-else-if="rows.length === 0" class="state text-sm">{{ t('admin.jobs.empty') }}</p>

    <table v-else>
      <caption class="sr-only">{{ t('admin.recent.title') }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('admin.jobs.time') }}</th>
          <th scope="col">{{ t('admin.jobs.type') }}</th>
          <th scope="col">{{ t('admin.jobs.status') }}</th>
          <th scope="col">{{ t('admin.jobs.actor') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row._id">
          <td class="job-time" :data-label="t('admin.jobs.time')">{{ when(row.created_at) }}</td>
          <td :data-label="t('admin.jobs.type')">{{ typeLabel(row.type) }}</td>
          <td :data-label="t('admin.jobs.status')">
            <span class="job-status" :class="'is-' + row.status">{{ statusLabel(row.status) }}</span>
          </td>
          <td class="job-actor" :data-label="t('admin.jobs.actor')" :title="row.actor_name">{{ row.actor_name || t('common.unknown') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style>
.job-table {
  overflow: hidden;
}

.job-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.job-table th {
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

.job-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--board-line);
  vertical-align: top;
}

.job-table tbody tr:last-child td {
  border-bottom: 0;
}

.job-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--board-dim);
}

.job-actor {
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--board-dim);
}

.job-status.is-done { color: var(--board-green); }
.job-status.is-running,
.job-status.is-queued { color: var(--board-amber); }
.job-status.is-failed { color: var(--board-danger); }

@media (max-width: 639px) {
  .job-table thead {
    display: none;
  }
  .job-table,
  .job-table tbody,
  .job-table tr,
  .job-table td {
    display: block;
    width: 100%;
  }
  .job-table tr {
    padding: var(--space-2);
    border-bottom: 1px solid var(--board-line);
  }
  .job-table tbody tr:last-child {
    border-bottom: 0;
  }
  .job-table td {
    display: flex;
    gap: var(--space-3);
    padding: 2px 0;
    border-bottom: 0;
  }
  .job-table td::before {
    content: attr(data-label);
    flex: 0 0 6.5em;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--board-dim);
  }
  .job-actor {
    max-width: none;
  }
}
</style>
