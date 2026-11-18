<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
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
    auth() { return useAuthStore() },
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
    image(path) { return serverInfo.getImage(path, 'ingredient') },
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
  <section class="board py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="board-title">{{ t('ingredients.title') }}</h1>
        <p class="board-sub">{{ t('ingredients.subtitle') }}</p>
      </div>
      <router-link v-if="auth.isLogin" class="btn" to="/ingredient_edit">{{ t('edit.createIngredientTitle') }}</router-link>
    </div>

    <label class="sr-only" for="ingredient-filter">{{ t('ingredients.title') }}</label>
    <input id="ingredient-filter" v-model="q" class="input mt-4" type="search" :placeholder="t('home.pickerPlaceholder')" />

    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="search">{{ t('common.retry') }}</button>
    </div>
    <p v-else-if="groups.length === 0" class="state">
      {{ q.trim() ? t('ingredients.empty', { q: q }) : t('common.emptyTitle') }}
    </p>

    <div v-else class="mt-6 grid gap-6">
      <section v-for="group in groups" :key="group.type">
        <h2 class="eyebrow">{{ group.label }}</h2>
        <ul class="ruled mt-2">
          <li v-for="item in group.rows" :key="item.id" class="row-line">
            <router-link
              class="flex items-center gap-3 sm:gap-4 p-2"
              :to="{ path: '/ingredient_detail', query: { ingredient_id: item.id } }"
            >
              <img v-if="item.profile_image" class="w-11 h-11 sm:w-12 sm:h-12 shrink-0 object-cover rounded" :src="image(item.profile_image)" alt="" />
              <span class="flex-1 min-w-0">
                <span class="block font-bold truncate">{{ localName(item) }}</span>
                <span class="block text-xs sm:text-sm truncate" style="color: var(--board-dim)">
                  {{ locale === 'vi' && item.short_detail_vi ? item.short_detail_vi : item.short_detail }}
                </span>
                <span v-if="item.nutrition && item.nutrition.per_100g" class="block text-xs" style="color: var(--board-dim)">
                  {{ Math.round(item.nutrition.per_100g.calories) }} kcal / 100 g
                </span>
              </span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
