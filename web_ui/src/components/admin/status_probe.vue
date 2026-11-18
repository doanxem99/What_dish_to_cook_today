<script setup>
import { useI18n } from '../../i18n'

const { t } = useI18n()

//state: checking | ok | partial | missing. A failure always carries the next action.
//stale marks the last good snapshot after a failed poll; the strip names the failure once.
defineProps({
  label: { type: String, required: true },
  state: { type: String, default: 'checking' },
  value: { type: String, default: '' },
  note: { type: String, default: '' },
  stale: { type: Boolean, default: false },
  action: { type: String, default: '' }
})

const lampClass = state => (state === 'ok' ? 'ok' : state === 'partial' ? 'partial' : state === 'missing' ? 'missing' : '')
</script>

<template>
  <div class="probe row-line" :class="{ 'is-stale': stale }">
    <span class="lamp" :class="lampClass(state)" aria-hidden="true"></span>
    <span class="sr-only">{{ t('admin.probe.state.' + state) }}</span>
    <div class="probe-body">
      <p class="probe-name">{{ label }}</p>
      <p class="probe-value">
        {{ state === 'checking' ? t('admin.probe.checking') : value }}
      </p>
      <p v-if="note && state !== 'checking'" class="probe-note" :title="note">{{ note }}</p>
      <p v-if="state === 'missing' && action" class="probe-action">{{ action }}</p>
    </div>
  </div>
</template>

<style>
.probe {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.probe:last-child {
  border-bottom: 0;
}

.probe .lamp {
  margin-top: 5px;
  flex: 0 0 auto;
}

.probe-body {
  flex: 1;
  min-width: 0;
}

.probe-name {
  margin: 0;
  font-weight: 700;
  font-size: 13px;
}

.probe-value {
  margin: 2px 0 0;
  font-size: 15px;
  color: var(--board-ink);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

/*A failed poll keeps the last good values on screen; the strip says they are old.*/
.probe.is-stale .probe-value {
  color: var(--board-dim);
}

.probe-note {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--board-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probe-action {
  margin: var(--space-1) 0 0;
  font-size: 12px;
  color: var(--board-danger);
  max-width: 62ch;
}
</style>
