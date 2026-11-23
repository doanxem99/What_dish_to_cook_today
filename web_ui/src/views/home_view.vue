<script>
import { api } from '../api'
import { aiApi, askAvailable, ensureAskAvailable } from '../api/ai'
import { useI18n } from '../i18n'
import { usePantryStore } from '../assets/store/pantry_store'
import { useAuthStore } from '../assets/store/auth_store'

const TYPES = ['Food', 'Spice', 'Fruit', 'Other']

export default {
  data() {
    return {
      q: '',
      found: [],
      catalog: [],
      bestPost: null,
      loadingBest: true,
      searchError: false,
      needIngredient: false,
      searchTimer: null
    }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    pantry() { return usePantryStore() },
    auth() { return useAuthStore() },
    askAvailable() { return askAvailable.value },
    chosen() { return this.pantry.items },
    groups() {
      const source = this.q.trim() ? this.found : this.catalog
      return TYPES
        .map(type => ({
          type,
          label: this.t('ingredients.' + type.toLowerCase()),
          rows: source.filter(item => (item.type || 'Other') === type)
        }))
        .filter(group => group.rows.length > 0)
    },
    noResults() {
      return this.groups.length === 0 && !this.searchError
    }
  },
  mounted() {
    this.loadBest()
    this.loadCatalog()
    ensureAskAvailable()
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
  },
  methods: {
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    async loadBest() {
      this.loadingBest = true
      try {
        const response = await api.get('/api/dish/profile/get_best_dish_post')
        this.bestPost = response && response.data ? response.data : null
      } catch (error) {
        this.bestPost = null
      } finally {
        this.loadingBest = false
      }
    },
    async loadCatalog() {
      try {
        const payload = await api.get('/api/ingredient/selection/')
        this.catalog = payload && Array.isArray(payload.data) ? payload.data : []
      } catch (error) {
        this.catalog = []
        this.searchError = true
      }
    },
    queueSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.search(), 250)
    },
    async search() {
      this.searchError = false
      const term = this.q.trim()
      if (!term) {
        this.found = []
        return
      }
      try {
        const found = await api.get(`/api/ingredient/search/keyword/${encodeURIComponent(term)}`)
        this.found = Array.isArray(found) ? found : []
      } catch (error) {
        this.found = []
        this.searchError = true
      }
    },
    choose(item) {
      const wasChosen = this.isChosen(item)
      this.pantry.toggle(item)
      if (!wasChosen && this.auth.isLogin) {
        aiApi.recordEvent('ingredient_picked', item.id)
      }
      this.needIngredient = false
    },
    remove(item) {
      this.pantry.remove(item.id)
    },
    clear() {
      this.pantry.clear()
    },
    isChosen(item) {
      return this.pantry.items.some(entry => entry.id === item.id)
    },
    findDishes() {
      if (this.chosen.length === 0) {
        this.needIngredient = true
        return
      }
      this.$router.push({ path: '/dishes' })
    },
    openAsk() {
      window.dispatchEvent(new CustomEvent('ask:open'))
    }
  }
}
</script>

<template>
  <section class="board py-6">
    <h1 class="board-title">{{ t('home.title') }}</h1>
    <p class="board-sub measure">{{ t('home.subtitle') }}</p>

    <div class="grid gap-4 mt-4 lg:grid-cols-3">
      <div class="lg:col-span-2 ruled p-4">
        <h2 class="eyebrow">{{ t('home.pickerTitle') }}</h2>

        <form class="mt-2" role="search" @submit.prevent="search">
          <label class="sr-only" for="ingredient-search">{{ t('home.pickerTitle') }}</label>
          <input
            id="ingredient-search"
            v-model="q"
            class="input"
            type="search"
            :placeholder="t('home.pickerPlaceholder')"
            @input="queueSearch"
          />
        </form>

        <p v-if="searchError" class="state" role="alert">{{ t('common.errorBody') }}</p>
        <p v-else-if="noResults" class="state">{{ q.trim() ? t('ingredients.empty', { q: q }) : t('common.emptyTitle') }}</p>

        <div v-else class="mt-3 grid gap-3">
          <section v-for="group in groups" :key="group.type" role="group" :aria-label="group.label">
            <h3 class="eyebrow mb-1">{{ group.label }}</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="item in group.rows"
                :key="item.id"
                class="chip"
                :class="{ 'chip-chosen': isChosen(item) }"
                type="button"
                :aria-pressed="isChosen(item)"
                @click="choose(item)"
              >{{ isChosen(item) ? '−' : '+' }} {{ localName(item) }}</button>
            </div>
          </section>
        </div>

        <div class="mt-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="eyebrow">{{ t('home.find') }}</h2>
            <button v-if="chosen.length" class="btn btn-quiet text-xs" type="button" @click="clear">
              {{ t('home.clear') }}
            </button>
          </div>
          <div v-if="chosen.length" class="flex flex-wrap gap-2 mt-2">
            <span v-for="item in chosen" :key="item.id" class="chip">
              {{ localName(item) }}
              <button class="chip-remove" type="button" :aria-label="t('common.delete') + ' ' + localName(item)" @click="remove(item)">×</button>
            </span>
          </div>
          <p v-else class="mt-2 text-sm" style="color: var(--board-dim)">{{ t('home.chosenEmpty') }}</p>
          <div v-if="askAvailable && chosen.length === 0" class="mt-3">
            <p class="text-sm" style="color: var(--board-dim)">{{ t('ask.emptyCtaBody') }}</p>
            <button class="btn mt-2" type="button" @click="openAsk">{{ t('ask.emptyCta') }}</button>
          </div>
          <p v-if="needIngredient" class="mt-2 text-sm" role="alert" style="color: var(--board-danger)">{{ t('home.needOne') }}</p>
          <button class="btn btn-primary mt-3" type="button" @click="findDishes">
            {{ t('home.find') }}
          </button>
          <p v-if="chosen.length" class="eyebrow mt-2">{{ t('home.ready', { n: chosen.length }) }}</p>
        </div>
      </div>

      <aside class="ruled p-4">
        <h2 class="eyebrow">{{ t('home.dishOfDay') }}</h2>
        <p v-if="loadingBest" class="state" aria-live="polite">{{ t('common.loading') }}</p>
        <div v-else-if="bestPost">
          <p class="board-title mt-2" style="font-size: 20px">
            {{ locale === 'vi' && bestPost.name_vi ? bestPost.name_vi : bestPost.name }}
          </p>
          <p class="board-sub text-sm">
            {{ locale === 'vi' && bestPost.short_detail_vi ? bestPost.short_detail_vi : bestPost.short_detail }}
          </p>
          <router-link
            v-if="bestPost._id"
            class="btn mt-3"
            :to="{ path: '/dish_detail', query: { dish_post_id: bestPost._id } }"
          >{{ t('common.open') }}</router-link>
        </div>
        <p v-else class="state">{{ t('common.emptyTitle') }}</p>

        <h2 class="eyebrow mt-5">{{ t('home.howTitle') }}</h2>
        <ol class="mt-2 text-sm grid gap-1" style="color: var(--board-dim)">
          <li>1. {{ t('home.how1') }}</li>
          <li>2. {{ t('home.how2') }}</li>
          <li>3. {{ t('home.how3') }}</li>
        </ol>
      </aside>
    </div>
  </section>
</template>
