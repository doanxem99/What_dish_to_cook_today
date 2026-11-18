<script setup>
import { computed, onMounted, ref } from 'vue'
import adminApi from '../../api/admin'
import { useAuthStore } from '../../assets/store/auth_store'
import { useI18n } from '../../i18n'
import { errorKind, filterQuery } from '../../components/admin/admin_format.js'

const { t } = useI18n()
const auth = useAuthStore()

const PAGE_SIZE = 25

const action = ref('')
const actor = ref('')
const applied = ref({ action: '', actor: '' })
const page = ref(1)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref(null)

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const failure = computed(() => {
  const kind = errorKind(error.value)
  if (kind === 'unauthorized') return t('admin.status.signIn')
  if (kind === 'forbidden') return t('admin.forbidden.body')
  if (kind === 'server') return t('admin.request.server')
  return t('admin.audit.error')
})

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function target(row) {
  const type = row.target_type || ''
  const id = row.target_id || ''
  return [type, id].filter(Boolean).join(' ') || '—'
}

async function load() {
  loading.value = rows.value.length === 0
  try {
    const answer = await adminApi.audit(filterQuery({
      action: applied.value.action,
      actor: applied.value.actor,
      page: page.value
    }))
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

function applyFilters() {
  applied.value = { action: action.value.trim(), actor: actor.value.trim() }
  page.value = 1
  load()
}

function go(next) {
  page.value = Math.min(pages.value, Math.max(1, next))
  load()
}

onMounted(load)
</script>

<template>
  <div class="admin-view">
    <form class="admin-toolbar admin-audit-filters" @submit.prevent="applyFilters">
      <label class="field admin-filter">
        <span class="eyebrow">{{ t('admin.audit.filterAction') }}</span>
        <input v-model="action" class="input" type="text" :placeholder="t('admin.audit.actionPlaceholder')" />
      </label>
      <label class="field admin-filter">
        <span class="eyebrow">{{ t('admin.audit.filterActor') }}</span>
        <input v-model="actor" class="input" type="text" :placeholder="t('admin.audit.actorPlaceholder')" />
      </label>
      <button class="btn" type="submit">{{ t('admin.common.apply') }}</button>
    </form>
    <p class="admin-hint measure">{{ t('admin.audit.actionHint') }}</p>

    <div v-if="error" class="ruled admin-failure" role="alert">
      <p>{{ failure }}</p>
      <router-link v-if="errorKind(error) === 'unauthorized'" class="link" to="/signin">
        {{ t('admin.status.signInLink') }}
      </router-link>
      <button v-else class="btn" type="button" @click="load">{{ t('admin.common.retry') }}</button>
    </div>

    <div v-else class="ruled admin-table-wrap">
      <p v-if="loading" class="state text-sm">{{ t('admin.audit.loading') }}</p>
      <p v-else-if="rows.length === 0" class="state text-sm">{{ t('admin.audit.empty') }}</p>
      <table v-else class="admin-table admin-audit-table">
        <caption class="sr-only">{{ t('admin.audit.title') }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.audit.time') }}</th>
            <th scope="col">{{ t('admin.audit.actor') }}</th>
            <th scope="col">{{ t('admin.audit.action') }}</th>
            <th scope="col">{{ t('admin.audit.target') }}</th>
            <th scope="col">{{ t('admin.audit.result') }}</th>
            <th scope="col">{{ t('admin.audit.ip') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row._id || row.created_at">
            <td class="is-num" :data-label="t('admin.audit.time')">{{ when(row.created_at) }}</td>
            <td :data-label="t('admin.audit.actor')">{{ row.actor_name || '—' }}</td>
            <td class="admin-mono" :data-label="t('admin.audit.action')">{{ row.action || '—' }}</td>
            <td class="admin-ellipsis" :data-label="t('admin.audit.target')" :title="target(row)">{{ target(row) }}</td>
            <td :data-label="t('admin.audit.result')">
              <span :class="row.result === 'ok' ? 'audit-ok' : 'audit-failed'">
                {{ row.result === 'ok' ? t('admin.audit.resultOk') : t('admin.audit.resultFailed') }}
              </span>
            </td>
            <td class="is-num" :data-label="t('admin.audit.ip')">{{ row.ip || '—' }}</td>
          </tr>
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
  </div>
</template>

<style>
.admin-audit-filters .admin-filter {
  flex: 1 1 200px;
}

.audit-ok {
  color: var(--board-green);
}

.audit-failed {
  color: var(--board-danger);
}
</style>
