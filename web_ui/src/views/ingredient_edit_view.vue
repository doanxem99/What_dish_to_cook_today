<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import blocksEditor from '../components/blocks_editor.vue'

export default {
  components: { blocksEditor },
  data() {
    return {
      ingredientId: null,
      loading: true,
      saving: false,
      error: '',
      model: {
        name: '',
        name_vi: '',
        type: 'Food',
        short_detail: '',
        short_detail_vi: '',
        profile_image: '',
        blocks: []
      }
    }
  },
  computed: {
    t() { return useI18n().t },
    auth() { return useAuthStore() },
    creating() { return !this.ingredientId }
  },
  mounted() {
    this.ingredientId = this.$route.query.ingredient_id || null
    if (this.ingredientId) {
      this.load()
    } else {
      this.loading = false
    }
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const response = await api.get(`/api/ingredient/profile/get_ingredient/${this.ingredientId}`)
        const ingredient = response && response.data ? response.data : null
        if (ingredient) {
          this.model.name = ingredient.name || ''
          this.model.name_vi = ingredient.name_vi || ''
        }
        if (ingredient && ingredient.best_post_id) {
          const postResponse = await api.get(`/api/ingredient/profile/get_ingredient_post/${ingredient.best_post_id}`)
          const post = postResponse && postResponse.data ? postResponse.data : null
          if (post) {
            this.model.name = post.name || this.model.name
            this.model.name_vi = post.name_vi || this.model.name_vi
            this.model.type = post.type || 'Food'
            this.model.short_detail = post.short_detail || ''
            this.model.short_detail_vi = post.short_detail_vi || ''
            this.model.profile_image = post.profile_image || ''
            this.model.blocks = Array.isArray(post.display_blocks) ? post.display_blocks : []
          }
        }
      } catch (error) {
        this.error = this.t('common.errorBody')
      } finally {
        this.loading = false
      }
    },
    async upload(event) {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      const form = new FormData()
      form.append('file', file)
      try {
        const response = await fetch('/api/gallery_upload/temporary', { method: 'POST', credentials: 'include', body: form })
        const data = await response.json()
        if (data && data.isSuccess) {
          this.model.profile_image = data.path
        } else {
          this.error = (data && data.status) || this.t('common.errorBody')
        }
      } catch (error) {
        this.error = this.t('common.errorBody')
      }
    },
    async save() {
      this.error = ''
      if (!this.model.name.trim()) {
        this.error = this.t('auth.invalid')
        return
      }
      this.saving = true
      try {
        const payload = {
          name: this.model.name.trim(),
          name_vi: this.model.name_vi.trim(),
          type: this.model.type,
          short_detail: this.model.short_detail,
          short_detail_vi: this.model.short_detail_vi,
          profile_image: this.model.profile_image
        }
        if (this.creating) {
          const response = await api.post('/api/ingredient/profile/create_ingredient', payload)
          if (response && response.status === 0 && response.ingredient_id) {
            this.$router.push({ path: '/ingredient_detail', query: { ingredient_id: response.ingredient_id } })
            return
          }
          this.error = (response && response.detail) || this.t('common.errorBody')
        } else {
          const response = await api.post('/api/ingredient/profile/create_ingredient_post', {
            ingredient_id: this.ingredientId,
            ingredient_name: this.model.name.trim(),
            data: { ...payload, display_blocks: this.model.blocks }
          })
          if (response && (response.status === 0 || response.status === 1)) {
            this.$router.push({ path: '/ingredient_detail', query: { ingredient_id: this.ingredientId } })
            return
          }
          this.error = (response && response.detail) || this.t('common.errorBody')
        }
      } catch (error) {
        this.error = error.message || this.t('common.errorBody')
      } finally {
        this.saving = false
      }
    },
    cancel() {
      this.$router.push(this.ingredientId
        ? { path: '/ingredient_detail', query: { ingredient_id: this.ingredientId } }
        : '/ingredients')
    }
  }
}
</script>

<template>
  <section class="board board-narrow py-6">
    <p v-if="!auth.isLogin" class="state">
      {{ t('edit.signInFirst') }}
      <router-link class="link" to="/signin">{{ t('nav.signIn') }}</router-link>
    </p>

    <template v-else>
      <h1 class="board-title">{{ creating ? t('edit.createIngredientTitle') : t('edit.titleEditIngredient') }}</h1>
      <p v-if="loading" class="state" aria-live="polite">{{ t('common.loading') }}</p>

      <form v-else class="grid gap-4 mt-4" @submit.prevent="save">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="field">
            <span class="eyebrow">{{ t('edit.nameEn') }}</span>
            <input v-model="model.name" class="input" required />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.nameVi') }}</span>
            <input v-model="model.name_vi" class="input" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.type') }}</span>
            <select v-model="model.type" class="input">
              <option value="Food">{{ t('ingredients.food') }}</option>
              <option value="Spice">{{ t('ingredients.spice') }}</option>
              <option value="Fruit">{{ t('ingredients.fruit') }}</option>
              <option value="Other">{{ t('ingredients.other') }}</option>
            </select>
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.image') }}</span>
            <input type="file" accept="image/png,image/jpeg" @change="upload" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.shortEn') }}</span>
            <input v-model="model.short_detail" class="input" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.shortVi') }}</span>
            <input v-model="model.short_detail_vi" class="input" />
          </label>
        </div>

        <div>
          <h2 class="eyebrow mb-2">{{ t('edit.blocks') }}</h2>
          <blocksEditor v-model="model.blocks" />
        </div>

        <p v-if="error" class="text-sm" role="alert" style="color: var(--board-danger)">{{ error }}</p>

        <div class="flex gap-2">
          <button class="btn btn-primary" type="submit" :disabled="saving">
            {{ creating ? t('edit.createAction') : t('edit.save') }}
          </button>
          <button class="btn" type="button" @click="cancel">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </template>
  </section>
</template>
