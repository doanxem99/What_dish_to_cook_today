<template>
  <section v-if="visible" class="for-you ruled p-4 mt-4" aria-labelledby="for-you-title">
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="for-you-title" class="eyebrow">{{ t('forYou.title') }}</h2>
      <span class="for-you-note">{{ t('forYou.note') }}</span>
    </div>
    <ul class="for-you-list mt-2">
      <li v-for="row in rows" :key="row.dish_id" class="for-you-row">
        <router-link class="for-you-link" :to="{ path: '/dish_detail', query: { dish_id: row.dish_id } }">
          {{ localName(row) }}
        </router-link>
        <span class="for-you-reasons">
          <span v-for="reason in row.reasons" :key="reason" class="chip text-xs">{{ reasonLabel(reason) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script>
import api from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import { usePantryStore } from '../assets/store/pantry_store'

export default {
  name: 'for_you_strip',
  data() {
    return { rows: [], loading: false, timer: null }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    pantry() { return usePantryStore() },
    visible() {
      return this.auth.isLogin && this.rows.length > 0
    }
  },
  watch: {
    'pantry.total'() { this.queue() },
    'auth.isLogin'() { this.queue() }
  },
  mounted() {
    this.queue()
  },
  beforeUnmount() {
    if (this.timer) clearTimeout(this.timer)
  },
  methods: {
    localName(row) {
      return this.locale === 'vi' && row.name_vi ? row.name_vi : row.name
    },
    reasonLabel(reason) {
      return this.t(`forYou.reason.${reason}`)
    },
    queue() {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(this.load, 200)
    },
    async load() {
      if (!this.auth.isLogin || this.pantry.total === 0) {
        this.rows = []
        return
      }
      this.loading = true
      try {
        const ids = this.pantry.ids.join(',')
        const payload = await api.get(`/api/dish/suggestions?ingredients=${encodeURIComponent(ids)}&limit=3`)
        this.rows = Array.isArray(payload && payload.rows) ? payload.rows : []
      } catch (error) {
        this.rows = []
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.for-you { background: var(--board-raised); }
.for-you-note { font-size: 12px; color: var(--board-dim); }
.for-you-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.for-you-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.for-you-link { font-weight: 600; }
.for-you-reasons { display: inline-flex; flex-wrap: wrap; gap: 4px; }
</style>
