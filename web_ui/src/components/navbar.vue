<script>
import { useAuthStore } from '../assets/store/auth_store'
import { useI18n } from '../i18n'
import { currentTheme, toggleTheme } from '../theme'

export default {
  data() {
    return { q: '', theme: currentTheme() }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() }
  },
  methods: {
    submitSearch() {
      const query = this.q.trim()
      this.$router.push({ path: '/dishes', query: query ? { q: query } : {} })
    },
    async switchLocale(language) {
      await useI18n().setLocale(language)
    },
    async signOut() {
      await this.auth.signOut()
      this.$router.push('/')
    },
    switchTheme() {
      this.theme = toggleTheme()
    }
  }
}
</script>

<template>
  <header class="site-header border-b" style="border-color: var(--board-line)">
    <div class="board py-3 flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-3">
        <router-link to="/" class="board-title" style="font-size: 18px">{{ t('common.appName') }}</router-link>

        <form class="flex-1 min-w-48 flex gap-2" @submit.prevent="submitSearch">
          <input
            v-model="q"
            class="input"
            type="search"
            :aria-label="t('common.search')"
            :placeholder="t('nav.searchPlaceholder')"
          />
          <button class="btn" type="submit">{{ t('common.search') }}</button>
        </form>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-quiet"
            :class="{ 'is-active': locale === 'en' }"
            type="button"
            :aria-pressed="locale === 'en'"
            @click="switchLocale('en')"
          >EN</button>
          <button
            class="btn btn-quiet"
            :class="{ 'is-active': locale === 'vi' }"
            type="button"
            :aria-pressed="locale === 'vi'"
            @click="switchLocale('vi')"
          >VI</button>
          <button
            class="btn btn-quiet"
            type="button"
            :aria-pressed="theme === 'light'"
            @click="switchTheme"
          >{{ theme === 'light' ? t('theme.dark') : t('theme.light') }}</button>
        </div>

        <div class="flex items-center gap-2 text-sm">
          <template v-if="auth.isLogin">
            <router-link to="/profile" class="link">{{ auth.user?.username || t('nav.profile') }}</router-link>
            <button class="btn btn-quiet" type="button" @click="signOut">{{ t('nav.signOut') }}</button>
          </template>
          <template v-else>
            <router-link to="/signin" class="link">{{ t('nav.signIn') }}</router-link>
            <router-link to="/signup" class="link">{{ t('nav.signUp') }}</router-link>
          </template>
        </div>
      </div>

      <nav class="flex flex-wrap items-center gap-4 text-sm">
        <router-link to="/dishes" class="link">{{ t('nav.dishes') }}</router-link>
        <router-link to="/homemade" class="link">{{ t('nav.homemade') }}</router-link>
        <router-link to="/ingredients" class="link">{{ t('nav.ingredients') }}</router-link>
        <router-link to="/about" class="link">{{ t('nav.about') }}</router-link>
      </nav>
    </div>
  </header>
</template>
