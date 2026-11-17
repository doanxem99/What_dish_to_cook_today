<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { usePantryStore } from '../assets/store/pantry_store'
import { useAuthStore } from '../assets/store/auth_store'
import serverInfo from '../assets/js/server_info.js'
import dishProfileGenerate from '../components/dish_profile_generate.vue'

export default {
  components: { dishProfileGenerate },
  data() {
    return { rows: [], loading: true, failed: false, isGenerate: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    pantry() { return usePantryStore() },
    auth() { return useAuthStore() },
    chosen() { return this.pantry.items },
    query() { return this.$route.query.q || '' },
    heading() {
      if (this.query) return this.t('dishes.resultsFor', { q: this.query })
      if (this.chosen.length) return this.t('home.find')
      return this.t('dishes.title')
    }
  },
  watch: {
    '$route.query'() { this.load() }
  },
  mounted() { this.load() },
  methods: {
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    chosenName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    remove(item) {
      this.pantry.remove(item.id)
      this.load()
    },
    lampClass(row) {
      if (!row.total_ingredients) return 'partial'
      if (row.match_count === row.total_ingredients) return 'ok'
      return row.match_count > 0 ? 'partial' : 'missing'
    },
    async load() {
      this.loading = true
      this.failed = false
      try {
        let payload
        if (this.query) {
          payload = await api.get(`/api/dish/search/keyword/${encodeURIComponent(this.query)}`)
          this.rows = Array.isArray(payload) ? payload : []
        } else if (this.chosen.length) {
          payload = await api.get(`/api/dish/selection/ingredients/${this.pantry.ids.join('-')}`)
          const rows = payload && Array.isArray(payload.data) ? payload.data : []
          //The board ranks by how much of the dish the cook already has
          this.rows = rows.sort((a, b) => (b.match_count - a.match_count) || a.name.localeCompare(b.name))
        } else {
          payload = await api.get('/api/dish/selection/')
          this.rows = payload && Array.isArray(payload.data) ? payload.data : []
        }
      } catch (error) {
        this.rows = []
        this.failed = true
      } finally {
        this.loading = false
      }
    },
    refresh() { this.$router.go(0) },
    closeGenerate() { this.isGenerate = false }
  }
}
</script>

<template>
  <section class="board py-8">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="board-title">{{ heading }}</h1>
        <p class="board-sub">{{ t('dishes.subtitle') }}</p>
      </div>
      <button v-if="auth.isLogin && !chosen.length" class="btn" type="button" @click="isGenerate = true">
        {{ t('edit.newDish') }}
      </button>
    </div>

    <div v-if="chosen.length" class="flex flex-wrap items-center gap-2 mt-4">
      <span class="eyebrow">{{ t('home.pickerTitle') }}</span>
      <span v-for="item in chosen" :key="item.id" class="chip">
        {{ chosenName(item) }}
        <button class="chip-remove" type="button" :aria-label="t('common.delete') + ' ' + chosenName(item)" @click="remove(item)">×</button>
      </span>
    </div>

    <p v-if="loading" class="state" aria-live="polite">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state" role="alert">
      <p>{{ t('common.errorTitle') }}</p>
      <p class="text-sm">{{ t('common.errorBody') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>
    <div v-else-if="rows.length === 0" class="state">
      <p>{{ query ? t('dishes.noMatches', { q: query }) : t('dishes.emptyCatalog') }}</p>
    </div>

    <ul v-else class="mt-4 ruled">
      <li v-for="row in rows" :key="row.id" class="row-line">
        <router-link
          class="flex items-center gap-4 p-3"
          :to="{ path: '/dish_detail', query: { dish_id: row.id } }"
        >
          <span class="lamp" :class="lampClass(row)" aria-hidden="true"></span>
          <span v-if="row.total_ingredients" class="match-number" style="min-width: 58px">
            {{ row.match_count }}<span class="text-sm" style="color: var(--board-dim)">/{{ row.total_ingredients }}</span>
          </span>
          <img
            v-if="row.profile_image"
            class="w-16 h-16 object-cover rounded"
            :src="image(row.profile_image)"
            alt=""
          />
          <span class="flex-1">
            <span class="block font-bold text-lg">{{ localName(row) }}</span>
            <span class="block text-sm" style="color: var(--board-dim)">
              {{ locale === 'vi' && row.short_detail_vi ? row.short_detail_vi : row.short_detail }}
            </span>
          </span>
          <span class="eyebrow">{{ t('common.open') }}</span>
        </router-link>
      </li>
    </ul>

    <dishProfileGenerate v-if="isGenerate" :onRefesh="refresh" :onCancel="closeGenerate" />
  </section>
</template>
