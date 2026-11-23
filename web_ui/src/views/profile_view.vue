<script>
import { api } from '../api'
import { aiApi } from '../api/ai'
import { eventTargetHref, eventTypeKey, formatQuotaUsage } from '../components/ask_format.js'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import serverInfo from '../assets/js/server_info.js'

const HISTORY_PAGE_SIZE = 25

export default {
  data() {
    return {
      user: null,
      dishes: [],
      ingredients: [],
      loading: true,
      failed: false,
      coverError: false,
      ai: null,
      aiCapabilitySaved: 'read_only',
      aiLoading: true,
      aiError: '',
      aiNotice: '',
      capabilitySaving: false,
      historyLoaded: false,
      historyLoading: false,
      historyFailed: false,
      historyBusy: false,
      events: [],
      eventPage: 1,
      eventTotal: 0
    }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    bannerStyle() {
      const path = this.user && this.user.background_image
      return path ? { backgroundImage: `url(${this.image(path)})` } : {}
    },
    quotaText() {
      return this.ai && this.ai.quota ? formatQuotaUsage(this.ai.quota, this.t) : ''
    },
    historyPages() {
      return Math.max(1, Math.ceil(this.eventTotal / HISTORY_PAGE_SIZE))
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
    eventTypeKey,
    eventTargetHref,
    eventName(row) {
      if (!row.target_name && !row.target_name_vi) return ''
      return (this.locale === 'vi' && row.target_name_vi) ? row.target_name_vi : row.target_name
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
        await this.loadAi()
      } catch (error) {
        this.failed = true
      } finally {
        this.loading = false
      }
    },
    async loadAi() {
      this.aiLoading = true
      this.aiError = ''
      this.aiNotice = ''
      this.historyFailed = false
      const [status, history] = await Promise.allSettled([aiApi.status(), aiApi.listEvents(1)])
      if (status.status === 'fulfilled') {
        this.ai = status.value || null
        this.aiCapabilitySaved = (this.ai && this.ai.capability) || 'read_only'
      } else if ((status.reason && status.reason.status) !== 404) {
        this.aiError = 'common.errorBody'
      }
      if (history.status === 'fulfilled') {
        this.historyLoaded = true
        this.events = Array.isArray(history.value.rows) ? history.value.rows : []
        this.eventTotal = Number(history.value.total) || 0
        this.eventPage = Number(history.value.page) || 1
      } else if ((history.reason && history.reason.status) !== 404) {
        this.historyLoaded = true
        this.historyFailed = true
      }
      this.aiLoading = false
    },
    async loadEvents(page) {
      const next = Math.min(Math.max(1, page), this.historyPages)
      if (next === this.eventPage || this.historyLoading) return
      this.historyLoading = true
      this.historyFailed = false
      try {
        const result = await aiApi.listEvents(next)
        this.events = Array.isArray(result.rows) ? result.rows : []
        this.eventTotal = Number(result.total) || 0
        this.eventPage = Number(result.page) || next
      } catch (error) {
        this.historyFailed = true
      } finally {
        this.historyLoading = false
      }
    },
    async changeAiCapability() {
      const next = this.ai.capability
      this.capabilitySaving = true
      this.aiError = ''
      this.aiNotice = ''
      try {
        await aiApi.setCapability(next)
        this.aiCapabilitySaved = next
        this.aiNotice = 'profile.capabilitySaved'
      } catch (error) {
        this.ai.capability = this.aiCapabilitySaved
        this.aiError = 'common.errorBody'
      } finally {
        this.capabilitySaving = false
      }
    },
    async deleteConversation() {
      if (!window.confirm(this.t('profile.deleteConversationConfirm'))) return
      this.aiError = ''
      this.aiNotice = ''
      try {
        await aiApi.clearConversation()
        this.aiNotice = 'profile.conversationDeleted'
      } catch (error) {
        this.aiError = 'common.errorBody'
      }
    },
    async clearHistory() {
      if (!window.confirm(this.t('profile.clearHistoryConfirm'))) return
      this.historyBusy = true
      this.aiError = ''
      this.aiNotice = ''
      try {
        await aiApi.clearEvents()
        this.events = []
        this.eventTotal = 0
        this.eventPage = 1
        this.aiNotice = 'profile.historyCleared'
      } catch (error) {
        this.aiError = 'common.errorBody'
      } finally {
        this.historyBusy = false
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

      <section v-if="ai || historyLoaded" class="ruled p-4 mt-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="eyebrow">{{ t('profile.aiTitle') }}</h2>
          <p v-if="quotaText" class="text-sm" style="color: var(--board-dim)">{{ quotaText }}</p>
        </div>

        <p v-if="aiLoading" class="state text-sm">{{ t('common.loading') }}</p>

        <div v-else class="grid gap-3 sm:grid-cols-2 mt-2">
          <label v-if="ai" class="field">
            <span class="eyebrow">{{ t('profile.capability') }}</span>
            <select
              v-model="ai.capability"
              class="input"
              :disabled="capabilitySaving"
              @change="changeAiCapability"
            >
              <option value="read_only">{{ t('ask.capability.read_only') }}</option>
              <option value="prepare">{{ t('ask.capability.prepare') }}</option>
              <option value="act_freely">{{ t('ask.capability.act_freely') }}</option>
            </select>
          </label>
          <div v-if="ai" class="flex items-end">
            <button class="btn" type="button" @click="deleteConversation">{{ t('profile.deleteConversation') }}</button>
          </div>
        </div>

        <p v-if="ai && ai.enabled === false" class="text-sm mt-2" style="color: var(--board-dim)">{{ t('ask.disabled') }}</p>
        <p v-if="aiError" class="text-sm mt-2" role="alert" style="color: var(--board-danger)">{{ t(aiError) }}</p>
        <p v-if="aiNotice" class="text-sm mt-2" role="status" style="color: var(--board-green)">{{ t(aiNotice) }}</p>

        <div v-if="historyLoaded" class="mt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="eyebrow">{{ t('profile.historyTitle') }}</h3>
            <button
              v-if="events.length"
              class="btn btn-quiet text-xs"
              type="button"
              :disabled="historyBusy"
              @click="clearHistory"
            >{{ t('profile.clearHistory') }}</button>
          </div>

          <p v-if="historyLoading" class="state text-sm">{{ t('common.loading') }}</p>
          <p v-else-if="historyFailed" class="state text-sm" role="alert">{{ t('profile.historyLoadError') }}</p>
          <p v-else-if="events.length === 0" class="state text-sm">{{ t('profile.historyEmpty') }}</p>

          <ul v-else class="mt-2">
            <li v-for="row in events" :key="row.id" class="row-line p-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="text-xs" style="color: var(--board-dim)">{{ joined(row.created_at) }}</span>
              <span class="text-sm">{{ t(eventTypeKey(row.type)) }}</span>
              <router-link
                v-if="eventTargetHref(row) && eventName(row)"
                class="link text-sm"
                :to="eventTargetHref(row)"
              >{{ eventName(row) }}</router-link>
              <span v-else-if="eventName(row)" class="text-sm">{{ eventName(row) }}</span>
            </li>
          </ul>

          <div v-if="historyPages > 1" class="flex flex-wrap items-center gap-2 mt-2">
            <button class="btn text-xs" type="button" :disabled="eventPage <= 1 || historyLoading" @click="loadEvents(eventPage - 1)">
              {{ t('profile.prev') }}
            </button>
            <span class="text-xs" style="color: var(--board-dim)">
              {{ t('profile.page', { page: eventPage, pages: historyPages }) }}
            </span>
            <button class="btn text-xs" type="button" :disabled="eventPage >= historyPages || historyLoading" @click="loadEvents(eventPage + 1)">
              {{ t('profile.next') }}
            </button>
          </div>
        </div>
      </section>

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
