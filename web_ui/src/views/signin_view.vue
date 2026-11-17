<script>
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'

export default {
  data() {
    return { username: '', password: '', error: '' }
  },
  computed: {
    t() { return useI18n().t },
    auth() { return useAuthStore() }
  },
  methods: {
    async submit() {
      this.error = ''
      if (!this.username.trim() || !this.password) {
        this.error = this.t('auth.invalid')
        return
      }
      const success = await this.auth.signIn({ username: this.username.trim(), password: this.password })
      if (!success) {
        this.error = this.t('auth.failed')
        return
      }
      const jump = this.auth.jumpPage || '/'
      this.auth.jumpPage = null
      this.$router.push(jump)
    }
  }
}
</script>

<template>
  <section class="board board-form py-10">
    <h1 class="board-title">{{ t('auth.signInTitle') }}</h1>

    <form class="grid gap-4 mt-4 ruled p-4" @submit.prevent="submit">
      <label class="field">
        <span class="text-sm">{{ t('auth.username') }}</span>
        <input v-model="username" class="input" autocomplete="username" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('auth.password') }}</span>
        <input v-model="password" class="input" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="text-sm" style="color: var(--board-danger)">{{ error }}</p>
      <button class="btn btn-primary" type="submit">{{ t('auth.submitSignIn') }}</button>
      <p class="text-sm" style="color: var(--board-dim)">
        {{ t('auth.needAccount') }}
        <router-link class="link" to="/signup">{{ t('nav.signUp') }}</router-link>
      </p>
    </form>
  </section>
</template>
