<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import serverInfo from '../assets/js/server_info.js'

const TYPES = ['Food', 'Spice', 'Fruit', 'Other']

export default {
  data() {
    return { items: [], q: '', loading: true, failed: false, searchTimer: null }
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    groups() {
      return TYPES.map(type => ({
        type,
        label: this.t('ingredients.' + type.toLowerCase()),
        rows: this.items.filter(item => (item.type || 'Other') === type)
      })).filter(group => group.rows.length > 0)
    }
  },
  watch: {
    q() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.search(), 250)
    }
  },
  mounted() { this.search() },
  methods: {
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    async search() {
      this.loading = true
      this.failed = false
      try {
        if (this.q.trim()) {
          const rows = await api.get(`/api/ingredient/search/keyword/${encodeURIComponent(this.q.trim())}`)
          this.items = Array.isArray(rows) ? rows : []
        } else {
          const payload = await api.get('/api/ingredient/selection/')
          this.items = payload && Array.isArray(payload.data) ? payload.data : []
        }
      } catch (error) {
        this.items = []
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
    <h1 class="board-title">{{ t('ingredients.title') }}</h1>
    <p class="board-sub">{{ t('ingredients.subtitle') }}</p>

    <label class="sr-only" for="ingredient-filter">{{ t('ingredients.title') }}</label>
    <input id="ingredient-filter" v-model="q" class="input mt-4" type="search" :placeholder="t('home.pickerPlaceholder')" />

    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="search">{{ t('common.retry') }}</button>
    </div>
    <p v-else-if="groups.length === 0" class="state">{{ t('ingredients.empty', { q: q }) }}</p>

    <div v-else class="mt-6 grid gap-6">
      <section v-for="group in groups" :key="group.type">
        <h2 class="eyebrow">{{ group.label }}</h2>
        <ul class="ruled mt-2">
          <li v-for="item in group.rows" :key="item.id" class="row-line">
            <router-link
              class="flex items-center gap-4 p-3"
              :to="{ path: '/ingredient_detail', query: { ingredient_id: item.id } }"
            >
              <img v-if="item.profile_image" class="w-12 h-12 object-cover rounded" :src="image(item.profile_image)" alt="" />
              <span class="flex-1 font-bold">{{ localName(item) }}</span>
              <span class="text-sm" style="color: var(--board-dim)">{{ item.short_detail }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
