<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import { usePantryStore } from '../assets/store/pantry_store'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return {
      post: null,
      dish: null,
      comments: [],
      ingredients: [],
      commentBody: '',
      loading: true,
      pageError: false,
      commentError: false,
      voteError: false,
      votePoints: 0,
      voted: false,
      ownPostId: null
    }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    pantry() { return usePantryStore() },
    title() {
      if (!this.post) return ''
      const name = this.locale === 'vi' && this.post.name_vi ? this.post.name_vi : this.post.name
      return name || (this.dish && this.dish.name) || ''
    },
    shortDetail() {
      if (!this.post) return ''
      return this.locale === 'vi' && this.post.short_detail_vi ? this.post.short_detail_vi : this.post.short_detail
    },
    dishId() {
      return this.post && this.post.dish_id ? this.post.dish_id : (this.dish ? this.dish._id : null)
    }
  },
  mounted() { this.load() },
  methods: {
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    blockText(block) {
      return this.locale === 'vi' && block.text_vi ? block.text_vi : block.text
    },
    ingredientName(item) {
      return this.locale === 'vi' && item.name_vi ? item.name_vi : item.name
    },
    isChosen(item) {
      return this.pantry.items.some(entry => entry.id === item.id)
    },
    async load() {
      this.loading = true
      this.pageError = false
      try {
        let post = null
        if (this.$route.query.dish_id) {
          const dishResponse = await api.get(`/api/dish/profile/get_dish/${this.$route.query.dish_id}`)
          this.dish = dishResponse && dishResponse.data ? dishResponse.data : null
          if (this.dish && this.dish.best_post_id) {
            const postResponse = await api.get(`/api/dish/profile/get_dish_post/${this.dish.best_post_id}`)
            post = postResponse ? postResponse.data : null
          }
        } else if (this.$route.query.dish_post_id) {
          const postResponse = await api.get(`/api/dish/profile/get_dish_post/${this.$route.query.dish_post_id}`)
          post = postResponse ? postResponse.data : null
        }
        this.post = post
        this.votePoints = post && post.points ? post.points : 0
        if (post) {
          await Promise.all([this.loadComments(), this.loadIngredients(), this.loadOwnPost()])
        }
      } catch (error) {
        this.pageError = true
      } finally {
        this.loading = false
      }
    },
    async loadComments() {
      try {
        const response = await api.get(`/api/dish/profile/comments/${this.post._id}`)
        this.comments = response && Array.isArray(response.data) ? response.data : []
      } catch (error) {
        this.comments = []
      }
    },
    async loadIngredients() {
      const ids = (this.post.ingredients || []).join('-')
      if (!ids) {
        this.ingredients = []
        return
      }
      try {
        const rows = await api.get(`/api/ingredient/search/ids/${ids}`)
        this.ingredients = Array.isArray(rows) ? rows : []
      } catch (error) {
        this.ingredients = []
      }
    },
    async loadOwnPost() {
      if (!this.auth.isLogin || !this.post || !this.post.dish_id) return
      try {
        const response = await api.get('/api/dish/profile/mine')
        const rows = response && Array.isArray(response.data) ? response.data : []
        const mine = rows.find(row => String(row.id) === String(this.post._id))
        this.ownPostId = mine ? mine.id : null
      } catch (error) {
        this.ownPostId = null
      }
    },
    async submitComment() {
      const body = this.commentBody.trim()
      if (!body || !this.post) return
      this.commentError = false
      try {
        await api.post(`/api/dish/profile/comment/${this.post._id}`, { body })
        this.commentBody = ''
        await this.loadComments()
      } catch (error) {
        //Keep the typed body; only the comment area reports the failure
        this.commentError = true
      }
    },
    async deleteComment(comment) {
      if (!window.confirm(this.t('dish.commentDeleteConfirm'))) return
      this.commentError = false
      try {
        await api.del(`/api/dish/profile/comment/${comment.id}`)
        await this.loadComments()
      } catch (error) {
        this.commentError = true
      }
    },
    async toggleVote() {
      if (!this.auth.isLogin || !this.post) return
      this.voteError = false
      try {
        const response = await api.post(`/api/dish/profile/vote/${this.post._id}`)
        const data = response && response.data ? response.data : {}
        this.voted = !!data.voted
        this.votePoints = typeof data.points === 'number' ? data.points : this.votePoints
      } catch (error) {
        this.voteError = true
      }
    }
  }
}
</script>

<template>
  <section class="board py-6">
    <p v-if="loading" class="state" aria-live="polite">{{ t('common.loading') }}</p>
    <div v-else-if="pageError" class="state" role="alert">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>
    <div v-else-if="!post" class="state">{{ t('dish.notFound') }}</div>

    <template v-else>
      <div v-if="ownPostId && ownPostId !== post._id" class="ruled p-2 mb-4 flex items-center justify-between gap-2">
        <span class="text-sm">{{ t('dish.yourVersion') }}</span>
        <router-link class="btn" :to="{ path: '/dish_detail', query: { dish_post_id: ownPostId } }">
          {{ t('dish.showYours') }}
        </router-link>
      </div>

      <header class="ruled p-4">
        <div class="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
          <div class="min-w-0">
            <h1 class="board-title">{{ title }}</h1>
            <p class="board-sub">{{ shortDetail }}</p>
            <p class="eyebrow mt-3">
              {{ t('dish.author', { name: post.username || post.user_id || t('common.unknown') }) }}
            </p>
          </div>
          <div class="min-w-0 sm:text-right">
            <div class="flex items-center gap-2 sm:block">
              <p class="match-number">{{ votePoints }}</p>
              <p class="eyebrow">{{ t('dish.vote') }}</p>
              <button
                class="btn ml-auto sm:ml-0 sm:mt-2"
                :class="{ 'btn-primary': voted }"
                type="button"
                :disabled="!auth.isLogin"
                @click="toggleVote"
              >{{ voted ? t('dish.voted') : t('dish.vote') }}</button>
            </div>
            <p v-if="voteError" class="text-xs mt-2" role="alert" style="color: var(--board-danger)">{{ t('common.errorBody') }}</p>
            <p v-if="!auth.isLogin" class="text-xs mt-2" style="color: var(--board-dim)">
              <router-link class="link" to="/signin">{{ t('nav.signIn') }}</router-link>
            </p>
            <router-link
              v-if="auth.isLogin && dishId"
              class="link text-xs mt-3 block"
              :to="{ path: '/dish_edit', query: { dish_id: dishId } }"
            >{{ t('common.edit') }}</router-link>
          </div>
        </div>
        <img
          v-if="post.profile_image"
          class="mt-4 w-full max-h-64 object-cover rounded"
          :src="image(post.profile_image)"
          alt=""
        />
        <div v-if="post.images && post.images.length" class="flex gap-2 mt-3 overflow-x-auto">
          <img
            v-for="(path, index) in post.images"
            :key="path + index"
            class="w-20 h-20 object-cover rounded shrink-0"
            :src="image(path)"
            alt=""
          />
        </div>
      </header>

      <section v-if="ingredients.length" class="ruled p-4 mt-4">
        <h2 class="eyebrow">{{ t('dish.ingredients') }}</h2>
        <div class="flex flex-wrap gap-2 mt-3">
          <span
            v-for="item in ingredients"
            :key="item.id"
            class="chip"
            :class="{ 'chip-chosen': isChosen(item) }"
          >{{ ingredientName(item) }}</span>
        </div>
      </section>

      <div class="grid gap-4 mt-4 lg:grid-cols-3">
        <article class="lg:col-span-2 ruled p-4">
          <template v-for="(block, index) in (post.display_blocks || [])" :key="index">
            <p v-if="block.type === 'text'" class="mb-4 leading-relaxed" :style="{ fontSize: (block.font_size || 16) + 'px' }">
              {{ blockText(block) }}
            </p>
            <figure v-else-if="block.type === 'image' && block.src" class="mb-4">
              <img class="w-full rounded" :src="image(block.src)" :alt="blockText(block) || ''" />
              <figcaption v-if="blockText(block)" class="text-sm mt-1" style="color: var(--board-dim)">
                {{ blockText(block) }}
              </figcaption>
            </figure>
          </template>
          <p v-if="!post.display_blocks || post.display_blocks.length === 0" class="state">
            {{ t('common.emptyTitle') }}
          </p>
        </article>

        <aside class="ruled p-4">
          <h2 class="eyebrow">{{ t('dish.commentsTitle') }}</h2>

          <form v-if="auth.isLogin" class="mt-3" @submit.prevent="submitComment">
            <label class="field">
              <span class="text-sm">{{ t('dish.commentPlaceholder') }}</span>
              <textarea v-model="commentBody" class="textarea" rows="3" maxlength="1000"></textarea>
            </label>
            <p v-if="commentError" class="text-sm mt-2" role="alert" style="color: var(--board-danger)">
              {{ t('common.errorBody') }}
            </p>
            <button class="btn btn-primary mt-2" type="submit" :disabled="!commentBody.trim()">
              {{ t('dish.commentSubmit') }}
            </button>
          </form>
          <p v-else class="text-sm mt-3" style="color: var(--board-dim)">
            <router-link class="link" to="/signin">{{ t('dish.commentSignIn') }}</router-link>
          </p>

          <p v-if="comments.length === 0" class="state text-sm">{{ t('dish.commentEmpty') }}</p>
          <ul v-else class="mt-4 grid gap-2">
            <li v-for="comment in comments" :key="comment.id" class="row-line pb-3">
              <p class="text-sm font-bold">{{ comment.username }}</p>
              <p class="text-sm">{{ comment.body }}</p>
              <button
                v-if="comment.is_mine"
                class="btn btn-quiet text-xs mt-1"
                type="button"
                @click="deleteComment(comment)"
              >{{ t('common.delete') }}</button>
            </li>
          </ul>
        </aside>
      </div>
    </template>
  </section>
</template>
