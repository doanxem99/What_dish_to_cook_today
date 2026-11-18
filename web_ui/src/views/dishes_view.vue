<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { usePantryStore } from '../assets/store/pantry_store'
import { useAuthStore } from '../assets/store/auth_store'
import serverInfo from '../assets/js/server_info.js'

const VIEW_KEY = 'dishes-view'

export default {
  data() {
    return { rows: [], loading: true, failed: false, view: 'list' }
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
      if (this.chosen.length) return this.t('dishes.board')
      return this.t('dishes.title')
    }
  },
  watch: {
    '$route.query'() { this.load() }
  },
  mounted() {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      if (saved === 'grid' || saved === 'list') this.view = saved
    } catch (error) {
      this.view = 'list'
    }
    this.load()
  },
  methods: {
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    ingredientLine(row) {
      if (!Array.isArray(row.ingredients_detail)) return ''
      return row.ingredients_detail.map(item => this.localName(item)).join(' · ')
    },
    detail(row) {
      return (this.locale === 'vi' && row.short_detail_vi) ? row.short_detail_vi : (row.short_detail || '')
    },
    image(path) { return serverInfo.getImage(path, 'dish') },
    setView(view) {
      this.view = view
      try { localStorage.setItem(VIEW_KEY, view) } catch (error) { /* session only */ }
    },
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
    openNew() { this.$router.push('/dish_edit') }
  }
}
</script>

<template>
  <section class="board py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="board-title">{{ heading }}</h1>
        <p class="board-sub">{{ t('dishes.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="view-switch" role="group" :aria-label="t('dishes.view')">
          <button
            class="icon-btn"
            :class="{ 'is-active': view === 'list' }"
            type="button"
            :aria-label="t('dishes.listView')"
            :aria-pressed="view === 'list'"
            :title="t('dishes.listView')"
            @click="setView('list')"
          ><font-awesome-icon :icon="['fas', 'list']" /></button>
          <button
            class="icon-btn"
            :class="{ 'is-active': view === 'grid' }"
            type="button"
            :aria-label="t('dishes.gridView')"
            :aria-pressed="view === 'grid'"
            :title="t('dishes.gridView')"
            @click="setView('grid')"
          ><font-awesome-icon :icon="['fas', 'table-cells']" /></button>
        </div>
        <button v-if="auth.isLogin" class="btn" type="button" @click="openNew">
          {{ t('edit.newDish') }}
        </button>
      </div>
    </div>

    <div v-if="chosen.length" class="flex flex-wrap items-center gap-2 mt-4">
      <span class="eyebrow">{{ t('home.pickerTitle') }}</span>
      <span v-for="item in chosen" :key="item.id" class="chip">
        {{ localName(item) }}
        <button class="chip-remove" type="button" :aria-label="t('common.delete') + ' ' + localName(item)" @click="remove(item)">×</button>
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

    <ul v-else-if="view === 'list'" class="mt-4 ruled">
      <li v-for="row in rows" :key="row.id" class="row-line">
        <router-link
          class="flex items-center gap-2 sm:gap-3 p-2"
          :to="{ path: '/dish_detail', query: { dish_id: row.id } }"
        >
          <span class="lamp" :class="lampClass(row)" aria-hidden="true"></span>
          <span v-if="row.total_ingredients" class="match-number row-match">
            {{ row.match_count }}<span class="text-sm" style="color: var(--board-dim)">/{{ row.total_ingredients }}</span>
          </span>
          <img
            v-if="row.profile_image"
            class="w-11 h-11 sm:w-12 sm:h-12 shrink-0 object-cover rounded"
            :src="image(row.profile_image)"
            alt=""
          />
          <span class="flex-1 min-w-0">
            <span class="block font-bold truncate">{{ localName(row) }}</span>
            <span class="hidden sm:block text-xs truncate" style="color: var(--board-dim)">
              {{ locale === 'vi' && row.short_detail_vi ? row.short_detail_vi : row.short_detail }}
            </span>
            <span v-if="ingredientLine(row)" class="block text-xs truncate" style="color: var(--board-dim)">
              {{ ingredientLine(row) }}
            </span>
          </span>
        </router-link>
      </li>
    </ul>

    <ul v-else class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="row in rows" :key="row.id" class="flex">
        <router-link class="ruled flex flex-col w-full overflow-hidden" :to="{ path: '/dish_detail', query: { dish_id: row.id } }">
          <img
            v-if="row.profile_image"
            class="w-full h-36 object-cover"
            :src="image(row.profile_image)"
            alt=""
          />
          <div class="p-3 flex-1">
            <div class="flex items-center gap-2">
              <span class="lamp" :class="lampClass(row)" aria-hidden="true"></span>
              <span class="font-bold">{{ localName(row) }}</span>
              <span v-if="row.total_ingredients" class="ml-auto text-xs" style="color: var(--board-dim)">
                {{ row.match_count }}/{{ row.total_ingredients }}
              </span>
            </div>
            <p class="text-xs mt-1 line-clamp-2" :title="detail(row)" style="color: var(--board-dim)">
              {{ detail(row) }}
            </p>
          </div>
        </router-link>
      </li>
    </ul>
  </section>
</template>
