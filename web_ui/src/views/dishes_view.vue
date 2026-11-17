<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return { rows: [], loading: true, failed: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    query() { return this.$route.query.q || '' },
    ingredientIds() { return this.$route.query.ingredients || '' },
    heading() {
      if (this.query) return this.t('dishes.resultsFor', { q: this.query })
      if (this.ingredientIds) return this.t('home.find')
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
    image(path) {
      return path ? serverInfo.getFullPath(path) : ''
    },
    async load() {
      this.loading = true
      this.failed = false
      try {
        let payload
        if (this.ingredientIds) {
          payload = await api.get(`/api/dish/selection/ingredients/${this.ingredientIds}`)
          this.rows = payload && Array.isArray(payload.data) ? payload.data : []
        } else if (this.query) {
          payload = await api.get(`/api/dish/search/keyword/${encodeURIComponent(this.query)}`)
          this.rows = Array.isArray(payload) ? payload : []
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
    }
  }
}
</script>

<template>
  <section class="board py-8">
    <h1 class="board-title">{{ heading }}</h1>
    <p class="board-sub">{{ t('dishes.subtitle') }}</p>

    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
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
          <span class="lamp" :class="ingredientIds ? 'ok' : 'partial'" aria-hidden="true"></span>
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
          <span class="eyebrow">{{ t('common.edit') === 'Edit' ? 'OPEN' : 'MỞ' }}</span>
        </router-link>
      </li>
    </ul>
  </section>
</template>
