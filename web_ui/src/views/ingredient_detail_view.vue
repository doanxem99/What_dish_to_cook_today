<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return { ingredient: null, post: null, loading: true, failed: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    title() {
      if (!this.ingredient) return ''
      return this.locale === 'vi' && this.ingredient.name_vi ? this.ingredient.name_vi : this.ingredient.name
    }
  },
  mounted() { this.load() },
  methods: {
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    blockText(block) {
      return this.locale === 'vi' && block.text_vi ? block.text_vi : block.text
    },
    async load() {
      this.loading = true
      this.failed = false
      try {
        const response = await api.get(`/api/ingredient/profile/get_ingredient/${this.$route.query.ingredient_id}`)
        this.ingredient = response && response.data ? response.data : null
        if (this.ingredient && this.ingredient.best_post_id) {
          const postResponse = await api.get(`/api/ingredient/profile/get_ingredient_post/${this.ingredient.best_post_id}`)
          this.post = postResponse && postResponse.data ? postResponse.data : null
        }
      } catch (error) {
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
    <p v-if="loading" class="state" aria-live="polite">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state" role="alert">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>
    <p v-else-if="!ingredient" class="state">{{ t('common.emptyTitle') }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="board-title">{{ title }}</h1>
        <router-link
          v-if="auth.isLogin"
          class="btn"
          :to="{ path: '/ingredient_edit', query: { ingredient_id: ingredient._id } }"
        >{{ t('common.edit') }}</router-link>
      </div>
      <p v-if="post" class="board-sub">
        {{ locale === 'vi' && post.short_detail_vi ? post.short_detail_vi : post.short_detail }}
      </p>

      <div v-if="ingredient.nutrition && ingredient.nutrition.per_100g" class="ruled p-4 mt-4">
        <h2 class="eyebrow">{{ t('edit.nutrition') }} (100 g)</h2>
        <p class="text-sm mt-2" style="color: var(--board-dim)">
          {{ ingredient.nutrition.description }}
        </p>
        <p class="text-sm mt-1">
          {{ Math.round(ingredient.nutrition.per_100g.calories) }} kcal ·
          P {{ ingredient.nutrition.per_100g.protein }} g ·
          F {{ ingredient.nutrition.per_100g.fat }} g ·
          C {{ ingredient.nutrition.per_100g.carbs }} g ·
          Na {{ ingredient.nutrition.per_100g.sodium }} mg
        </p>
      </div>

      <div v-if="post" class="ruled p-4 mt-6">
        <template v-for="(block, index) in (post.display_blocks || [])" :key="index">
          <p v-if="block.type === 'text'" class="mb-4 leading-relaxed">{{ blockText(block) }}</p>
          <figure v-else-if="block.type === 'image' && block.src" class="mb-4">
            <img class="w-full rounded" :src="image(block.src)" :alt="blockText(block) || ''" />
          </figure>
        </template>
      </div>
      <p v-else class="state">{{ t('common.emptyTitle') }}</p>
    </template>
  </section>
</template>
