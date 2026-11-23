<script setup>
import { computed, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import ConfirmDialog from '../../components/admin/confirm_dialog.vue'
import { errorKind, formatCost, formatTokens } from '../../components/admin/admin_format.js'
import { notify } from '../../components/admin/admin_toast.js'

const { t } = useI18n()
const auth = useAuthStore()

const usage = ref(null)
const loading = ref(true)
const error = ref(null)
const switchBusy = ref(false)
const switchError = ref('')
const confirmSwitch = ref(false)
const reindexBusy = ref(false)

const configured = computed(() => Boolean(usage.value && usage.value.configured))
const enabled = computed(() => Boolean(usage.value && usage.value.enabled))
const totals = computed(() => (usage.value && usage.value.totals) || {})
const recent = computed(() => (usage.value && Array.isArray(usage.value.recent) ? usage.value.recent : []))
const byDay = computed(() => (usage.value && Array.isArray(usage.value.by_day) ? usage.value.by_day : []))
const budgetReached = computed(() => Boolean(usage.value && usage.value.budget_reached))

//Rows are grouped by UTC day on the server, so today must use the same clock.
const todayCalls = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return byDay.value
    .filter(row => row && row.day === today)
    .reduce((sum, row) => sum + (Number(row.calls) || 0), 0)
})

const stats = computed(() => [
  { label: t('admin.ai.totalCalls'), value: formatTokens(totals.value.calls) },
  { label: t('admin.ai.today'), value: formatTokens(todayCalls.value) },
  { label: t('admin.ai.tokensIn'), value: formatTokens(totals.value.tokens_in) },
  { label: t('admin.ai.tokensOut'), value: formatTokens(totals.value.tokens_out) },
  { label: t('admin.ai.cost'), value: formatCost(totals.value.cost_estimate) },
  { label: t('admin.ai.errors'), value: formatTokens(totals.value.errors) }
])

const failure = computed(() => {
  const kind = errorKind(error.value)
  if (kind === 'unauthorized') return t('admin.status.signIn')
  if (kind === 'forbidden') return t('admin.forbidden.body')
  if (kind === 'server') return t('admin.request.server')
  return t('admin.ai.error')
})

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function latency(value) {
  return Number.isFinite(Number(value)) && value !== null ? t('admin.probe.latency', { ms: Number(value) }) : '—'
}

async function load() {
  loading.value = usage.value === null
  try {
    usage.value = await adminApi.aiUsage()
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

function askSwitch() {
  switchError.value = ''
  confirmSwitch.value = true
}

function closeSwitch() {
  confirmSwitch.value = false
  switchError.value = ''
}

async function applySwitch() {
  if (!usage.value || switchBusy.value) {
    return
  }
  switchBusy.value = true
  switchError.value = ''
  try {
    const answer = await adminApi.setAiEnabled(!enabled.value)
    usage.value = { ...usage.value, enabled: Boolean(answer && answer.enabled) }
    closeSwitch()
    notify(t('admin.ai.switchSaved'))
  } catch (caught) {
    const kind = errorKind(caught)
    if (kind === 'unauthorized') {
      closeSwitch()
      await auth.signOut()
    } else {
      switchError.value = kind === 'server' ? t('admin.request.server') : t('admin.ai.switchFailed')
    }
  } finally {
    switchBusy.value = false
  }
}

async function reindex() {
  if (reindexBusy.value) {
    return
  }
  reindexBusy.value = true
  try {
    await adminApi.reindexAi()
    notify(t('admin.ai.reindexQueued'))
  } catch (caught) {
    if (errorKind(caught) === 'unauthorized') {
      await auth.signOut()
    } else {
      notify(t('admin.ai.reindexFailed'), 'error')
    }
  } finally {
    reindexBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="admin-view">
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

    <p v-else-if="loading" class="state text-sm">{{ t('admin.ai.loading') }}</p>

    <template v-else-if="!configured">
      <section class="ruled admin-empty-panel" aria-labelledby="admin-ai-off-title">
        <h2 id="admin-ai-off-title" class="admin-section-title">{{ t('admin.ai.unavailableTitle') }}</h2>
        <p class="measure">{{ t('admin.ai.unavailableBody') }}</p>
        <router-link class="btn" to="/admin">{{ t('admin.ai.back') }}</router-link>
      </section>
    </template>

    <template v-else>
      <section aria-labelledby="admin-ai-title">
        <div class="admin-section-head">
          <h2 id="admin-ai-title" class="admin-section-title">{{ t('admin.ai.metricsTitle') }}</h2>
          <div class="admin-ai-actions">
            <button class="btn btn-quiet" type="button" :disabled="reindexBusy" @click="reindex">
              {{ reindexBusy ? t('admin.common.working') : t('admin.ai.rebuildIndex') }}
            </button>
            <button
              class="btn admin-switch"
              :class="{ 'is-on': enabled }"
              type="button"
              role="switch"
              :aria-checked="enabled ? 'true' : 'false'"
              :disabled="switchBusy"
              @click="askSwitch"
            >{{ enabled ? t('admin.ai.switchEnabled') : t('admin.ai.switchDisabled') }}</button>
          </div>
        </div>
        <p class="admin-hint measure">{{ t('admin.ai.switchNote') }}</p>

        <p v-if="budgetReached" class="ruled admin-ai-banner is-budget" role="alert">
          {{ t('admin.ai.budgetReached') }}
        </p>
        <p v-else-if="!enabled" class="ruled admin-ai-banner" role="status">
          {{ t('admin.ai.paused') }}
        </p>

        <p class="ruled admin-ai-budget">
          {{ t('admin.ai.budgetLine', {
            spent: formatCost(usage.month_cost_estimate),
            budget: formatCost(usage.budget_usd)
          }) }}
        </p>

        <dl class="ruled admin-ai-stats">
          <div v-for="stat in stats" :key="stat.label" class="admin-ai-stat">
            <dt>{{ stat.label }}</dt>
            <dd>{{ stat.value }}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="admin-ai-days-title">
        <h2 id="admin-ai-days-title" class="admin-section-title">{{ t('admin.ai.byDayTitle') }}</h2>
        <div class="ruled admin-table-wrap">
          <p v-if="byDay.length === 0" class="state text-sm">{{ t('admin.ai.empty') }}</p>
          <table v-else class="admin-table admin-ai-table">
            <caption class="sr-only">{{ t('admin.ai.byDayTitle') }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ t('admin.ai.day') }}</th>
                <th scope="col">{{ t('admin.ai.model') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.calls') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensIn') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensOut') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.cost') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.errors') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.avgLatency') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in byDay" :key="`${row.day}-${row.model}`">
                <td class="is-num" :data-label="t('admin.ai.day')">{{ row.day }}</td>
                <td class="admin-ellipsis" :data-label="t('admin.ai.model')" :title="row.model || ''">
                  {{ row.model || '—' }}
                </td>
                <td class="is-num" :data-label="t('admin.ai.calls')">{{ formatTokens(row.calls) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensIn')">{{ formatTokens(row.tokens_in) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensOut')">{{ formatTokens(row.tokens_out) }}</td>
                <td class="is-num" :data-label="t('admin.ai.cost')">{{ formatCost(row.cost_estimate) }}</td>
                <td class="is-num" :data-label="t('admin.ai.errors')">{{ formatTokens(row.errors) }}</td>
                <td class="is-num" :data-label="t('admin.ai.avgLatency')">{{ latency(row.avg_latency_ms) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="admin-ai-recent-title">
        <h2 id="admin-ai-recent-title" class="admin-section-title">{{ t('admin.ai.recentTitle') }}</h2>
        <div class="ruled admin-table-wrap">
          <p v-if="recent.length === 0" class="state text-sm">{{ t('admin.ai.empty') }}</p>
          <table v-else class="admin-table admin-ai-table">
            <caption class="sr-only">{{ t('admin.ai.recentTitle') }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ t('admin.ai.time') }}</th>
                <th scope="col">{{ t('admin.ai.model') }}</th>
                <th scope="col">{{ t('admin.ai.mode') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.latency') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensIn') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensOut') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.cost') }}</th>
                <th scope="col">{{ t('admin.ai.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recent" :key="row.id || row.created_at">
                <td class="is-num" :data-label="t('admin.ai.time')">{{ when(row.created_at) }}</td>
                <td class="admin-ellipsis" :data-label="t('admin.ai.model')" :title="row.model || row.provider || ''">
                  {{ row.model || row.provider || '—' }}
                </td>
                <td :data-label="t('admin.ai.mode')">{{ row.mode || '—' }}</td>
                <td class="is-num" :data-label="t('admin.ai.latency')">{{ latency(row.latency_ms) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensIn')">{{ formatTokens(row.tokens_in) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensOut')">{{ formatTokens(row.tokens_out) }}</td>
                <td class="is-num" :data-label="t('admin.ai.cost')">{{ formatCost(row.cost_estimate) }}</td>
                <td :data-label="t('admin.ai.status')" :title="row.error_code || ''">
                  {{ row.error_code || row.status || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <ConfirmDialog
      :open="confirmSwitch"
      :title="enabled ? t('admin.ai.switchOffTitle') : t('admin.ai.switchOnTitle')"
      :body="enabled ? t('admin.ai.switchOffBody') : t('admin.ai.switchOnBody')"
      :confirm-label="enabled ? t('admin.ai.switchOff') : t('admin.ai.switchOn')"
      :busy="switchBusy"
      :error="switchError"
      @close="closeSwitch"
      @confirm="applySwitch"
    />
  </div>
</template>

<style>
.admin-ai-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.admin-switch {
  font-size: 12px;
}

.admin-switch.is-on {
  border-color: var(--board-amber);
  color: var(--board-amber);
}

.admin-ai-banner {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  color: var(--board-ink);
}

.admin-ai-banner.is-budget {
  color: var(--board-danger);
}

.admin-ai-budget {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--board-dim);
}

.admin-ai-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-2) var(--space-3);
  margin: 0;
  padding: var(--space-3);
}

.admin-ai-stat {
  display: grid;
  gap: 2px;
}

.admin-ai-stat dt {
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--board-dim);
}

.admin-ai-stat dd {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--board-ink);
}

.admin-empty-panel {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-5);
}

@media (max-width: 639px) {
  .admin-ai-actions {
    width: 100%;
  }
  .admin-ai-stat dd {
    font-size: 17px;
  }
}
</style>
