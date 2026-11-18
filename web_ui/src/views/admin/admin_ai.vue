<script setup>
import { computed, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import { errorKind, formatCost, formatTokens, jobStatusLabel } from '../../components/admin/admin_format.js'

const { t } = useI18n()
const auth = useAuthStore()

const configured = ref(null)
const rows = ref([])
const loading = ref(true)
const error = ref(null)

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
  loading.value = rows.value.length === 0
  try {
    const [health, jobs] = await Promise.all([
      adminApi.health(),
      adminApi.jobs({ type: 'ai', page: 1 })
    ])
    configured.value = Boolean(health && health.ai && health.ai.configured)
    rows.value = jobs && Array.isArray(jobs.rows) ? jobs.rows : []
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

    <template v-else-if="configured === false">
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
          <p class="admin-ai-switch">
            <button
              class="btn admin-switch"
              type="button"
              role="switch"
              aria-checked="false"
              disabled
            >{{ t('admin.ai.switchLabel') }}</button>
          </p>
        </div>
        <p class="admin-hint measure">{{ t('admin.ai.switchNote') }}</p>

        <div class="ruled admin-table-wrap">
          <p v-if="loading" class="state text-sm">{{ t('admin.ai.loading') }}</p>
          <p v-else-if="rows.length === 0" class="state text-sm">{{ t('admin.ai.empty') }}</p>
          <table v-else class="admin-table admin-ai-table">
            <caption class="sr-only">{{ t('admin.ai.metricsTitle') }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ t('admin.ai.time') }}</th>
                <th scope="col">{{ t('admin.ai.model') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.latency') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensIn') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.tokensOut') }}</th>
                <th scope="col" class="is-num">{{ t('admin.ai.cost') }}</th>
                <th scope="col">{{ t('admin.ai.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row._id || row.created_at">
                <td class="is-num" :data-label="t('admin.ai.time')">{{ when(row.created_at) }}</td>
                <td class="admin-ellipsis" :data-label="t('admin.ai.model')" :title="row.model || row.provider || ''">
                  {{ row.model || row.provider || '—' }}
                </td>
                <td class="is-num" :data-label="t('admin.ai.latency')">{{ latency(row.latency_ms) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensIn')">{{ formatTokens(row.tokens_in) }}</td>
                <td class="is-num" :data-label="t('admin.ai.tokensOut')">{{ formatTokens(row.tokens_out) }}</td>
                <td class="is-num" :data-label="t('admin.ai.cost')">{{ formatCost(row.cost_estimate) }}</td>
                <td :data-label="t('admin.ai.status')">{{ jobStatusLabel(row.status, t) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style>
.admin-ai-switch {
  margin: 0;
}

.admin-switch {
  font-size: 12px;
  cursor: not-allowed;
}

.admin-switch[disabled] {
  opacity: 0.75;
}

.admin-empty-panel {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-5);
}
</style>
