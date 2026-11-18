<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import { RETRYABLE_TYPES, jobStatusLabel, jobTypeLabel } from './admin_format.js'

const { t } = useI18n()

const props = defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  expandable: { type: Boolean, default: false },
  retryable: { type: Boolean, default: false },
  captionKey: { type: String, default: 'admin.recent.title' },
  emptyKey: { type: String, default: 'admin.jobs.empty' }
})

const emit = defineEmits(['retry'])

const expandedId = ref('')
const rowKey = row => String(row._id || row.id || row.created_at || '')
const columns = computed(() => 4 + (props.showDetail ? 1 : 0) + (props.expandable ? 1 : 0))

const canRetry = row => props.retryable && row.status === 'failed' && RETRYABLE_TYPES.includes(row.type)

function toggle(row) {
  const key = rowKey(row)
  expandedId.value = expandedId.value === key ? '' : key
}

function payloadText(row) {
  try {
    return JSON.stringify(row.payload || {}, null, 2)
  } catch (error) {
    return ''
  }
}

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
    <p v-else-if="rows.length === 0" class="state text-sm">{{ t(emptyKey) }}</p>

    <table v-else>
      <caption class="sr-only">{{ t(captionKey) }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('admin.jobs.time') }}</th>
          <th scope="col">{{ t('admin.jobs.type') }}</th>
          <th scope="col">{{ t('admin.jobs.status') }}</th>
          <th scope="col">{{ t('admin.jobs.actor') }}</th>
          <th v-if="showDetail" scope="col">{{ t('admin.jobs.detail') }}</th>
          <th v-if="expandable" scope="col" class="job-toggle-col">
            <span class="sr-only">{{ t('admin.common.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="rowKey(row)">
          <tr :class="{ 'is-expanded': expandedId === rowKey(row) }">
            <td class="job-time" :data-label="t('admin.jobs.time')">{{ when(row.created_at) }}</td>
            <td :data-label="t('admin.jobs.type')">{{ jobTypeLabel(row.type, t) }}</td>
            <td :data-label="t('admin.jobs.status')">
              <span class="job-status" :class="'is-' + row.status">{{ jobStatusLabel(row.status, t) }}</span>
            </td>
            <td class="job-actor" :data-label="t('admin.jobs.actor')" :title="row.actor_name">{{ row.actor_name || t('common.unknown') }}</td>
            <td v-if="showDetail" class="job-detail" :data-label="t('admin.jobs.detail')">
              <span :title="row.detail">{{ row.detail || '—' }}</span>
            </td>
            <td v-if="expandable" class="job-toggle" :data-label="t('admin.common.actions')">
              <button
                class="job-toggle-btn"
                type="button"
                :aria-expanded="expandedId === rowKey(row)"
                :aria-label="expandedId === rowKey(row) ? t('admin.jobs.collapse') : t('admin.jobs.expand')"
                :title="expandedId === rowKey(row) ? t('admin.jobs.collapse') : t('admin.jobs.expand')"
                @click="toggle(row)"
              >{{ expandedId === rowKey(row) ? '-' : '+' }}</button>
            </td>
          </tr>

          <tr v-if="expandable && expandedId === rowKey(row)" class="job-expand">
            <td :colspan="columns">
              <dl class="job-facts">
                <div v-if="row.error" class="job-fact">
                  <dt>{{ t('admin.jobs.jobError') }}</dt>
                  <dd class="job-error-text">{{ row.error }}</dd>
                </div>
                <div class="job-fact">
                  <dt>{{ t('admin.jobs.payload') }}</dt>
                  <dd><pre class="job-payload">{{ payloadText(row) }}</pre></dd>
                </div>
              </dl>
              <div v-if="canRetry(row)" class="job-expand-actions">
                <button class="btn" type="button" @click="emit('retry', row)">{{ t('admin.jobs.retry') }}</button>
              </div>
            </td>
          </tr>
        </template>
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

.job-detail {
  max-width: 30ch;
  color: var(--board-dim);
}

.job-detail span {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.job-toggle-col {
  width: 44px;
}

.job-toggle {
  width: 44px;
}

.job-toggle-btn {
  width: 26px;
  height: 24px;
  border: 1px solid var(--board-line);
  border-radius: 4px;
  background: transparent;
  color: var(--board-dim);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.job-toggle-btn:hover {
  color: var(--board-ink);
  border-color: var(--board-line-strong);
}

.job-toggle-btn:focus-visible {
  outline: 2px solid var(--board-amber);
  outline-offset: 1px;
}

.job-table tr.is-expanded td {
  border-bottom-color: transparent;
}

.job-expand > td {
  background: var(--board-bg);
  padding: var(--space-3);
}

.job-facts {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.job-fact {
  display: grid;
  grid-template-columns: 8em minmax(0, 1fr);
  gap: var(--space-3);
}

.job-fact dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--board-dim);
  padding-top: 2px;
}

.job-fact dd {
  margin: 0;
  min-width: 0;
}

.job-error-text {
  color: var(--board-danger);
  overflow-wrap: anywhere;
}

.job-payload {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  color: var(--board-dim);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.job-expand-actions {
  margin-top: var(--space-3);
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
  .job-actor,
  .job-detail {
    max-width: none;
  }
  .job-toggle {
    justify-content: flex-start;
  }
  .job-expand > td {
    background: transparent;
    padding: var(--space-2) 0 var(--space-3);
  }
  .job-expand > td::before {
    content: none;
  }
  .job-fact {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
