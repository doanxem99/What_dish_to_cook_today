<script>
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'

export default {
  data() {
    return { username: '', email: '', password: '', confirm: '', error: '', done: false }
  },
  computed: {
    t() { return useI18n().t },
    auth() { return useAuthStore() }
  },
  methods: {
    async submit() {
      this.error = ''
      if (!this.username.trim() || !this.email.trim() || !this.password) {
        this.error = this.t('auth.invalid')
        return
      }
      if (this.password !== this.confirm) {
        this.error = this.t('auth.invalid')
        return
      }
      const success = await this.auth.signUp({
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password
      })
      if (!success) {
        this.error = this.auth.errorMessage || this.t('auth.invalid')
        return
      }
      this.done = true
      this.$router.push('/signin')
    }
  }
}
</script>

<template>
  <section class="board py-10 max-w-md">
    <h1 class="board-title">{{ t('auth.signUpTitle') }}</h1>

    <form class="grid gap-4 mt-6 ruled p-5" @submit.prevent="submit">
      <label class="field">
        <span class="text-sm">{{ t('auth.username') }}</span>
        <input v-model="username" class="input" autocomplete="username" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('auth.email') }}</span>
        <input v-model="email" class="input" type="email" autocomplete="email" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('auth.password') }}</span>
        <input v-model="password" class="input" type="password" autocomplete="new-password" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('auth.confirmPassword') }}</span>
        <input v-model="confirm" class="input" type="password" autocomplete="new-password" required />
      </label>
      <p v-if="error" class="text-sm" style="color: var(--board-danger)">{{ error }}</p>
      <button class="btn btn-primary" type="submit">{{ t('auth.submitSignUp') }}</button>
      <p class="text-sm" style="color: var(--board-dim)">
        {{ t('auth.haveAccount') }}
        <router-link class="link" to="/signin">{{ t('nav.signIn') }}</router-link>
      </p>
    </form>
  </section>
</template>
