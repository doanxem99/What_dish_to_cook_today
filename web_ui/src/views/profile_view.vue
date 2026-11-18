<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import serverInfo from '../assets/js/server_info.js'

export default {
  data() {
    return { user: null, dishes: [], ingredients: [], loading: true, failed: false, coverError: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    bannerStyle() {
      const path = this.user && this.user.background_image
      return path ? { backgroundImage: `url(${this.image(path)})` } : {}
    }
  },
  mounted() { this.load() },
  methods: {
    image(path) { return path ? serverInfo.getFullPath(path) : '' },
    joined(value) {
      if (!value) return ''
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
    },
    async uploadCover(event) {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      this.coverError = false
      try {
        const form = new FormData()
        form.append('file', file)
        const response = await fetch('/api/gallery_upload/temporary', { method: 'POST', credentials: 'include', body: form })
        const data = await response.json()
        if (!data || !data.isSuccess) {
          this.coverError = true
          return
        }
        await api.post('/api/auth/background', { background_image: data.path })
        this.user.background_image = data.path
      } catch (error) {
        this.coverError = true
      } finally {
        if (event.target) event.target.value = ''
      }
    },
    initial() {
      return (this.user && this.user.username ? this.user.username[0] : '?').toUpperCase()
    },
    async load() {
      this.loading = true
      this.failed = false
      try {
        const me = await api.get('/api/auth/me')
        this.user = me && me.user ? me.user : null
        const [dishes, ingredients] = await Promise.all([
          api.get('/api/dish/profile/mine'),
          api.get('/api/ingredient/profile/mine')
        ])
        this.dishes = dishes && Array.isArray(dishes.data) ? dishes.data : []
        this.ingredients = ingredients && Array.isArray(ingredients.data) ? ingredients.data : []
      } catch (error) {
        this.failed = true
      } finally {
        this.loading = false
      }
    },
    async signOut() {
      await this.auth.signOut()
      this.$router.push('/')
    }
  }
}
</script>

<template>
  <section class="board py-6">
    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>

    <template v-else-if="user">
      <div class="profile-banner" :class="{ 'is-empty': !user.background_image }" :style="bannerStyle">
        <label class="btn profile-cover-action">
          {{ t('profile.changeCover') }}
          <input class="sr-only" type="file" accept="image/png,image/jpeg" @change="uploadCover" />
        </label>
      </div>
      <p v-if="coverError" class="text-sm mt-2" role="alert" style="color: var(--board-danger)">{{ t('common.errorBody') }}</p>

      <div class="profile-head">
        <span class="profile-avatar" aria-hidden="true">{{ initial() }}</span>
        <div class="flex-1 min-w-0">
          <h1 class="board-title">{{ user.username }}</h1>
          <p v-if="joined(user.created_at)" class="board-sub">
            {{ t('profile.joined', { date: joined(user.created_at) }) }}
          </p>
        </div>
        <button class="btn" type="button" @click="signOut">{{ t('nav.signOut') }}</button>
      </div>

      <div class="grid gap-4 mt-4 lg:grid-cols-2">
        <section>
          <h2 class="eyebrow">{{ t('profile.myDishes') }}</h2>
          <p v-if="dishes.length === 0" class="state text-sm">{{ t('profile.noPosts') }}</p>
          <ul v-else class="ruled mt-2">
            <li v-for="row in dishes" :key="row.id" class="row-line p-2 flex items-center justify-between gap-2">
              <span>{{ row.name_vi && locale === 'vi' ? row.name_vi : row.name }}</span>
              <span v-if="row.is_best_post" class="chip text-xs">{{ t('profile.best') }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 class="eyebrow">{{ t('profile.myIngredients') }}</h2>
          <p v-if="ingredients.length === 0" class="state text-sm">{{ t('profile.noPosts') }}</p>
          <ul v-else class="ruled mt-2">
            <li v-for="row in ingredients" :key="row.id" class="row-line p-2 flex items-center justify-between gap-2">
              <span>{{ row.name_vi && locale === 'vi' ? row.name_vi : row.name }}</span>
              <span v-if="row.is_best_post" class="chip text-xs">{{ t('profile.best') }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>
