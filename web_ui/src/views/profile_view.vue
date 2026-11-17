<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'

export default {
  data() {
    return { user: null, dishes: [], ingredients: [], loading: true, failed: false }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() }
  },
  mounted() { this.load() },
  methods: {
    joined(value) {
      if (!value) return ''
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
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
  <section class="board py-8">
    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="state">
      <p>{{ t('common.errorTitle') }}</p>
      <button class="btn mt-3" type="button" @click="load">{{ t('common.retry') }}</button>
    </div>

    <template v-else-if="user">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="board-title">{{ user.username }}</h1>
          <p v-if="joined(user.created_at)" class="board-sub">
            {{ t('profile.joined', { date: joined(user.created_at) }) }}
          </p>
        </div>
        <button class="btn" type="button" @click="signOut">{{ t('nav.signOut') }}</button>
      </div>

      <div class="grid gap-6 mt-6 lg:grid-cols-2">
        <section>
          <h2 class="eyebrow">{{ t('profile.myDishes') }}</h2>
          <p v-if="dishes.length === 0" class="state text-sm">{{ t('profile.noPosts') }}</p>
          <ul v-else class="ruled mt-2">
            <li v-for="row in dishes" :key="row.id" class="row-line p-3 flex items-center justify-between gap-3">
              <span>{{ row.name_vi && locale === 'vi' ? row.name_vi : row.name }}</span>
              <span v-if="row.is_best_post" class="chip text-xs">{{ t('profile.best') }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 class="eyebrow">{{ t('profile.myIngredients') }}</h2>
          <p v-if="ingredients.length === 0" class="state text-sm">{{ t('profile.noPosts') }}</p>
          <ul v-else class="ruled mt-2">
            <li v-for="row in ingredients" :key="row.id" class="row-line p-3 flex items-center justify-between gap-3">
              <span>{{ row.name_vi && locale === 'vi' ? row.name_vi : row.name }}</span>
              <span v-if="row.is_best_post" class="chip text-xs">{{ t('profile.best') }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>
