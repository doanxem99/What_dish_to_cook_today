<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useAuthStore } from '../assets/store/auth_store'
import { useI18n } from '../i18n'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const current = ref('')
const next = ref('')
const repeat = ref('')
const error = ref('')
const saving = ref(false)

async function submit() {
  error.value = ''
  if (!current.value || !next.value) {
    error.value = t('auth.invalid')
    return
  }
  if (next.value !== repeat.value) {
    error.value = t('admin.password.mismatch')
    return
  }
  saving.value = true
  try {
    await api.post('/api/auth/password', { current_password: current.value, new_password: next.value })
    auth.passwordChanged()
    const target = auth.jumpPage || '/'
    auth.jumpPage = null
    router.push(target)
  } catch (requestError) {
    error.value = t('admin.password.failed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="board board-form py-10">
    <h1 class="board-title">{{ t('admin.password.title') }}</h1>
    <p class="board-sub measure">{{ t('admin.password.intro') }}</p>

    <form class="grid gap-4 mt-4 ruled p-4" @submit.prevent="submit">
      <label class="field">
        <span class="text-sm">{{ t('admin.password.current') }}</span>
        <input v-model="current" class="input" type="password" autocomplete="current-password" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('admin.password.new') }}</span>
        <input v-model="next" class="input" type="password" autocomplete="new-password" required />
      </label>
      <label class="field">
        <span class="text-sm">{{ t('admin.password.confirm') }}</span>
        <input v-model="repeat" class="input" type="password" autocomplete="new-password" required />
      </label>
      <p v-if="error" class="text-sm" role="alert" style="color: var(--board-danger)">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="saving">{{ t('admin.password.submit') }}</button>
    </form>
  </section>
</template>
