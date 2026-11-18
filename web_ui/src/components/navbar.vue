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
    auth() { return useAuthStore() },
    accountName() {
      return this.auth.isLogin ? (this.auth.user?.username || this.t('nav.profile')) : this.t('nav.signIn')
    }
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
    <div class="board header-bar">
      <router-link to="/" class="board-title brand">What dish to cook today?</router-link>

      <form class="header-search" role="search" @submit.prevent="submitSearch">
        <label class="sr-only" for="nav-search">{{ t('common.search') }}</label>
        <span class="search-wrap">
          <input
            id="nav-search"
            v-model="q"
            class="input search-input"
            type="search"
            :placeholder="t('nav.searchPlaceholder')"
          />
          <button class="search-go" type="submit" :aria-label="t('common.search')">
            <font-awesome-icon :icon="['fas', 'magnifying-glass']" />
          </button>
        </span>
      </form>

      <div class="header-tools">
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
          class="btn btn-quiet icon-only"
          type="button"
          role="switch"
          :aria-checked="theme === 'light'"
          :aria-label="t('theme.label')"
          :title="theme === 'light' ? t('theme.dark') : t('theme.light')"
          @click="switchTheme"
        ><font-awesome-icon :icon="theme === 'light' ? ['fas', 'moon'] : ['fas', 'sun']" /></button>

        <router-link
          :to="auth.isLogin ? '/profile' : '/signin'"
          class="btn btn-quiet account-link"
          :aria-label="accountName"
        >
          <font-awesome-icon :icon="['fas', 'circle-user']" />
          <span class="account-name">{{ accountName }}</span>
        </router-link>
        <button v-if="auth.isLogin" class="btn btn-quiet account-signout" type="button" @click="signOut">
          {{ t('nav.signOut') }}
        </button>
        <router-link v-else to="/signup" class="btn btn-quiet account-signout">{{ t('nav.signUp') }}</router-link>
        <router-link v-if="auth.isAdmin" to="/admin" class="btn btn-quiet admin-link" :title="t('admin.title')">{{ t('admin.nav.overview') }}</router-link>
      </div>

      <nav class="header-nav" aria-label="Main">
        <router-link to="/" class="link">{{ t('nav.home') }}</router-link>
        <router-link to="/dishes" class="link">{{ t('nav.dishes') }}</router-link>
        <router-link to="/homemade" class="link">{{ t('nav.homemade') }}</router-link>
        <router-link to="/ingredients" class="link">{{ t('nav.ingredients') }}</router-link>
        <router-link to="/about" class="link">{{ t('nav.about') }}</router-link>
      </nav>
    </div>
  </header>
</template>
