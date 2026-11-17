<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return { ingredient: null, post: null, loading: true, failed: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
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
  <section class="board py-8">
    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>
    <p v-else-if="!ingredient" class="state">{{ t('common.emptyTitle') }}</p>

    <template v-else>
      <h1 class="board-title">{{ title }}</h1>
      <p v-if="post" class="board-sub">
        {{ locale === 'vi' && post.short_detail_vi ? post.short_detail_vi : post.short_detail }}
      </p>

      <div v-if="post" class="ruled p-5 mt-6">
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
