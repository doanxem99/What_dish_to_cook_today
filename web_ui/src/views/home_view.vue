<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { usePantryStore } from '../assets/store/pantry_store'

export default {
  data() {
    return {
      q: '',
      found: [],
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
    chosen() { return this.pantry.items }
  },
  mounted() {
    this.loadBest()
    this.search()
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
    queueSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.search(), 250)
    },
    async search() {
      this.searchError = false
      const term = this.q.trim()
      const path = term
        ? `/api/ingredient/search/keyword/${encodeURIComponent(term)}`
        : '/api/ingredient/search/'
      try {
        const found = await api.get(path)
        this.found = Array.isArray(found) ? found : []
      } catch (error) {
        this.found = []
        this.searchError = true
      }
    },
    choose(item) {
      this.pantry.toggle(item)
      this.needIngredient = false
    },
    remove(item) {
      this.pantry.remove(item.id)
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
    }
  }
}
</script>

<template>
  <section class="board py-8">
    <h1 class="board-title">{{ t('home.title') }}</h1>
    <p class="board-sub max-w-2xl">{{ t('home.subtitle') }}</p>

    <div class="grid gap-6 mt-6 lg:grid-cols-3">
      <div class="lg:col-span-2 ruled p-4">
        <h2 class="eyebrow">{{ t('home.pickerTitle') }}</h2>

        <form class="flex gap-2 mt-3" role="search" @submit.prevent="search">
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

        <div v-else class="flex flex-wrap gap-2 mt-3">
          <button
            v-for="item in found"
            :key="item.id"
            class="chip"
            :class="{ 'chip-chosen': isChosen(item) }"
            type="button"
            :aria-pressed="isChosen(item)"
            @click="choose(item)"
          >{{ isChosen(item) ? '−' : '+' }} {{ localName(item) }}</button>
        </div>

        <div class="mt-6">
          <h2 class="eyebrow">{{ t('home.find') }}</h2>
          <div v-if="chosen.length" class="flex flex-wrap gap-2 mt-3">
            <span v-for="item in chosen" :key="item.id" class="chip">
              {{ localName(item) }}
              <button class="chip-remove" type="button" :aria-label="t('common.delete') + ' ' + localName(item)" @click="remove(item)">×</button>
            </span>
          </div>
          <p v-else class="mt-3 text-sm" style="color: var(--board-dim)">{{ t('home.chosenEmpty') }}</p>
          <p v-if="needIngredient" class="mt-2 text-sm" role="alert" style="color: var(--board-red)">{{ t('home.needOne') }}</p>
          <button class="btn btn-primary mt-4" type="button" @click="findDishes">
            {{ t('home.find') }}
          </button>
        </div>
      </div>

      <aside class="ruled p-4">
        <h2 class="eyebrow">{{ t('home.dishOfDay') }}</h2>
        <p v-if="loadingBest" class="state" aria-live="polite">{{ t('common.loading') }}</p>
        <div v-else-if="bestPost">
          <p class="board-title mt-2" style="font-size: 22px">
            {{ locale === 'vi' && bestPost.name_vi ? bestPost.name_vi : bestPost.name }}
          </p>
          <p class="board-sub text-sm">
            {{ locale === 'vi' && bestPost.short_detail_vi ? bestPost.short_detail_vi : bestPost.short_detail }}
          </p>
          <router-link
            v-if="bestPost._id"
            class="btn mt-4"
            :to="{ path: '/dish_detail', query: { dish_post_id: bestPost._id } }"
          >{{ t('common.open') }}</router-link>
        </div>
        <p v-else class="state">{{ t('common.emptyTitle') }}</p>

        <h2 class="eyebrow mt-6">{{ t('home.howTitle') }}</h2>
        <ol class="mt-2 text-sm grid gap-2" style="color: var(--board-dim)">
          <li>1. {{ t('home.how1') }}</li>
          <li>2. {{ t('home.how2') }}</li>
          <li>3. {{ t('home.how3') }}</li>
        </ol>
      </aside>
    </div>
  </section>
</template>
