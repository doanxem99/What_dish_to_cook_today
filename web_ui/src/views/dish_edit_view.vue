<script>
import { api } from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import ingredientPickerEdit from '../components/ingredient_picker_edit.vue'
import blocksEditor from '../components/blocks_editor.vue'

export default {
  components: { ingredientPickerEdit, blocksEditor },
  data() {
    return {
      dishId: null,
      loading: true,
      saving: false,
      error: '',
      autoTranslate: false,
      dragging: false,
      model: {
        name: '',
        name_vi: '',
        short_detail: '',
        short_detail_vi: '',
        profile_image: '',
        images: [],
        ingredients: [],
        blocks: []
      }
    }
  },
  computed: {
    t() { return useI18n().t },
    auth() { return useAuthStore() },
    creating() { return !this.dishId }
  },
  mounted() {
    this.dishId = this.$route.query.dish_id || null
    if (this.dishId) {
      this.load()
    } else {
      this.loading = false
    }
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const dishResponse = await api.get(`/api/dish/profile/get_dish/${this.dishId}`)
        const dish = dishResponse && dishResponse.data ? dishResponse.data : null
        if (dish) {
          this.model.name = dish.name || ''
          this.model.name_vi = dish.name_vi || ''
        }
        if (dish && dish.best_post_id) {
          const postResponse = await api.get(`/api/dish/profile/get_dish_post/${dish.best_post_id}`)
          const post = postResponse && postResponse.data ? postResponse.data : null
          if (post) {
            this.model.name = post.name || this.model.name
            this.model.name_vi = post.name_vi || this.model.name_vi
            this.model.short_detail = post.short_detail || ''
            this.model.short_detail_vi = post.short_detail_vi || ''
            this.model.profile_image = post.profile_image || ''
            this.model.images = Array.isArray(post.images) ? post.images : []
            this.model.blocks = Array.isArray(post.display_blocks) ? post.display_blocks : []
            const ids = (post.ingredients || []).join('-')
            if (ids) {
              const rows = await api.get(`/api/ingredient/search/ids/${ids}`)
              this.model.ingredients = Array.isArray(rows) ? rows.map(row => ({ id: row.id, name: row.name, name_vi: row.name_vi || null })) : []
            }
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
      await this.uploadOne(file, path => { this.model.profile_image = path })
      if (event.target) event.target.value = ''
    },
    async uploadOne(file, apply) {
      const form = new FormData()
      form.append('file', file)
      try {
        const response = await fetch('/api/gallery_upload/temporary', {
          method: 'POST',
          credentials: 'include',
          body: form
        })
        const data = await response.json()
        if (data && data.isSuccess) {
          apply(data.path)
        } else {
          this.error = (data && data.status) || this.t('common.errorBody')
        }
      } catch (error) {
        this.error = this.t('common.errorBody')
      }
    },
    onDropCover(event) {
      this.dragging = false
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
      if (file) this.uploadOne(file, path => { this.model.profile_image = path })
    },
    async addExtraImages(event) {
      const files = [...(event.target.files || [])]
      for (const file of files) {
        await this.uploadOne(file, path => { this.model.images.push(path) })
      }
      if (event.target) event.target.value = ''
    },
    async addExtraDrop(event) {
      this.dragging = false
      const files = [...((event.dataTransfer && event.dataTransfer.files) || [])]
      for (const file of files) {
        await this.uploadOne(file, path => { this.model.images.push(path) })
      }
    },
    removeExtra(index) {
      this.model.images.splice(index, 1)
    },
    imageSrc(path) {
      return path && path.startsWith('public/') ? '/' + path : path
    },
    async translateField(field) {
      if (!this.autoTranslate) return
      const sourceValue = this.model[field]
      if (!sourceValue || !sourceValue.trim()) return
      const viField = field === 'name' ? 'name_vi' : 'short_detail_vi'
      if (this.model[viField] && this.model[viField].trim()) return
      try {
        const response = await api.post('/api/translate', { text: sourceValue, source: 'en', target: 'vi' })
        this.model[viField] = response.text
      } catch (error) {
        this.error = this.t('edit.translateFailed')
      }
    },
    async save() {
      this.error = ''
      if (!this.model.name.trim() && !this.model.name_vi.trim()) {
        this.error = this.t('auth.invalid')
        return
      }
      this.saving = true
      try {
        const payload = {
          name: this.model.name.trim(),
          name_vi: this.model.name_vi.trim(),
          short_detail: this.model.short_detail,
          short_detail_vi: this.model.short_detail_vi,
          profile_image: this.model.profile_image,
          images: this.model.images,
          ingredients: this.model.ingredients.map(item => item.id),
          display_blocks: this.model.blocks
        }
        let response
        if (this.creating) {
          response = await api.post('/api/dish/profile/create_dish', payload)
          if (response && response.status === 0 && response.dish_id) {
            this.$router.push({ path: '/dish_detail', query: { dish_id: response.dish_id } })
            return
          }
        } else {
          response = await api.post('/api/dish/profile/create_dish_post', { dish_id: this.dishId, data: payload })
          if (response && (response.status === 0 || response.status === 1)) {
            this.$router.push({ path: '/dish_detail', query: { dish_id: this.dishId } })
            return
          }
        }
        this.error = (response && response.detail) || this.t('common.errorBody')
      } catch (error) {
        this.error = error.message || this.t('common.errorBody')
      } finally {
        this.saving = false
      }
    },
    cancel() {
      if (this.dishId) {
        this.$router.push({ path: '/dish_detail', query: { dish_id: this.dishId } })
      } else {
        this.$router.push('/dishes')
      }
    }
  }
}
</script>

<template>
  <section class="board py-6 max-w-3xl">
    <p v-if="!auth.isLogin" class="state">
      {{ t('edit.signInFirst') }}
      <router-link class="link" to="/signin">{{ t('nav.signIn') }}</router-link>
    </p>

    <template v-else>
      <h1 class="board-title">{{ creating ? t('edit.createTitle') : t('edit.titleEditDish') }}</h1>
      <p v-if="loading" class="state" aria-live="polite">{{ t('common.loading') }}</p>

      <form v-else class="grid gap-4 mt-4" @submit.prevent="save">
        <div class="ruled p-3">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="autoTranslate" />
            <span>{{ t('edit.autoTranslate') }}</span>
          </label>
          <p class="text-xs mt-1" style="color: var(--board-dim)">{{ t('edit.translateHint') }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="field">
            <span class="eyebrow">{{ t('edit.nameEn') }}</span>
            <input v-model="model.name" class="input" @blur="translateField('name')" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.nameVi') }}</span>
            <input v-model="model.name_vi" class="input" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.shortEn') }}</span>
            <input v-model="model.short_detail" class="input" @blur="translateField('short_detail')" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.shortVi') }}</span>
            <input v-model="model.short_detail_vi" class="input" />
          </label>
        </div>

        <div>
          <h2 class="eyebrow mb-2">{{ t('edit.ingredients') }}</h2>
          <ingredientPickerEdit v-model="model.ingredients" />
        </div>

        <div>
          <h2 class="eyebrow mb-2">{{ t('edit.image') }}</h2>
          <label
            class="dropzone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDropCover"
          >
            <input class="sr-only" type="file" accept="image/png,image/jpeg" @change="upload" />
            <img v-if="model.profile_image" class="w-16 h-16 object-cover rounded" :src="imageSrc(model.profile_image)" alt="" />
            <span class="text-sm" style="color: var(--board-dim)">{{ t('edit.dropCover') }}</span>
          </label>
        </div>

        <div>
          <h2 class="eyebrow mb-2">{{ t('edit.extraImages') }}</h2>
          <label
            class="dropzone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="addExtraDrop"
          >
            <input class="sr-only" type="file" accept="image/png,image/jpeg" multiple @change="addExtraImages" />
            <span class="text-sm" style="color: var(--board-dim)">{{ t('edit.dropCover') }}</span>
          </label>
          <div v-if="model.images.length" class="flex flex-wrap gap-2 mt-2">
            <span v-for="(path, index) in model.images" :key="path + index" class="extra-thumb">
              <img :src="imageSrc(path)" alt="" />
              <button class="chip-remove" type="button" :aria-label="t('common.delete')" @click="removeExtra(index)">×</button>
            </span>
          </div>
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
