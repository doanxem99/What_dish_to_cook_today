<script>
import { aiApi, askAvailable } from '../api/ai'
import { useAuthStore } from '../assets/store/auth_store'
import { usePantryStore } from '../assets/store/pantry_store'
import { useI18n } from '../i18n'
import {
  ASK_MODES,
  actionLink,
  citationHref,
  dishIdFromRoute,
  errorStateKey,
  mergeCitations,
  modeChip,
  toolSummaryKey,
  toolSummaryParams,
  validateMessageInput
} from './ask_format.js'

const CAPABILITIES = ['read_only', 'prepare', 'act_freely']

const historyTools = entry => (Array.isArray(entry.tool_summary) ? entry.tool_summary : []).map((tool) => {
  const { name, ...summary } = tool || {}
  return { name, summary }
})

const historyMessage = (entry) => ({
  role: entry.role === 'user' ? 'user' : 'assistant',
  content: entry.content || '',
  citations: Array.isArray(entry.citations) ? entry.citations : [],
  tools: historyTools(entry),
  actions: [],
  stopped: entry.stopped === true,
  empty: false,
  goal: entry.role === 'user' ? null : modeChip(entry.mode, entry.mode_source),
  goalOpen: false
})

const isAbort = error => Boolean(error && (error.name === 'AbortError' || error.code === 20))

export default {
  data() {
    return {
      open: false,
      loaded: false,
      loadingState: false,
      unavailable: false,
      enabled: true,
      quota: null,
      messages: [],
      draft: '',
      capability: 'read_only',
      capabilitySaved: 'read_only',
      streaming: false,
      thinking: false,
      loadError: '',
      errorKey: '',
      embedDown: false,
      controller: null,
      lastFocus: null,
      previousOverflow: '',
      modes: ASK_MODES,
      capabilities: CAPABILITIES
    }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    pantry() { return usePantryStore() },
    signedOut() { return !this.auth.isLogin },
    dishId() { return dishIdFromRoute(this.$route) },
    quotaReached() {
      return Boolean(this.quota && Number(this.quota.remaining) <= 0)
    },
    resetLabel() {
      if (!this.quota || !this.quota.resets_at) return ''
      const date = new Date(this.quota.resets_at)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString()
    },
    canSend() {
      if (this.signedOut || this.streaming || this.loadingState) return false
      if (!this.enabled || this.quotaReached) return false
      return validateMessageInput(this.draft)
    }
  },
  mounted() {
    window.addEventListener('ask:open', this.openPanel)
  },
  beforeUnmount() {
    window.removeEventListener('ask:open', this.openPanel)
    this.releaseScroll()
  },
  methods: {
    citationHref,
    toolSummaryKey,
    toolSummaryParams,
    toolLabel(tool) {
      return this.t(toolSummaryKey(tool), toolSummaryParams(tool))
    },
    citationName(citation) {
      return (this.locale === 'vi' && citation.name_vi) ? citation.name_vi : (citation.name || this.t('common.unknown'))
    },
    ingredientNames(items) {
      return (Array.isArray(items) ? items : [])
        .map(item => (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name)
        .filter(Boolean)
        .join(', ')
    },
    openPanel() {
      if (this.unavailable) return
      if (!this.open) {
        this.open = true
        this.lastFocus = document.activeElement
        this.previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      if (!this.signedOut && !this.loaded && !this.loadingState) {
        this.loadState()
      }
      this.$nextTick(() => {
        const input = this.$refs.input
        if (input && !input.disabled) {
          input.focus()
        } else if (this.$refs.panel) {
          this.$refs.panel.focus()
        }
        this.scrollToEnd(true)
      })
    },
    closePanel() {
      if (!this.open) return
      this.stop()
      this.open = false
      this.releaseScroll()
      this.$nextTick(() => {
        if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
          this.lastFocus.focus()
        }
      })
    },
    releaseScroll() {
      document.body.style.overflow = this.previousOverflow || ''
    },
    async loadState() {
      this.loadingState = true
      this.loadError = ''
      try {
        const [statusResult, conversationResult] = await Promise.allSettled([
          aiApi.status(),
          aiApi.conversation()
        ])
        if (statusResult.status === 'rejected') {
          const error = statusResult.reason || {}
          if (error.status === 404) {
            this.unavailable = true
            askAvailable.value = false
            this.closePanel()
            return
          }
          this.loadError = error.status === 401 ? 'ask.signInPrompt' : 'ask.error'
          return
        }
        const status = statusResult.value || {}
        this.enabled = status.enabled !== false
        this.quota = status.quota || null
        this.capability = CAPABILITIES.includes(status.capability) ? status.capability : 'read_only'
        if (conversationResult.status === 'fulfilled') {
          const conversation = conversationResult.value || {}
          this.messages = (Array.isArray(conversation.messages) ? conversation.messages : []).map(historyMessage)
          this.quota = conversation.quota || this.quota
          this.capability = CAPABILITIES.includes(conversation.capability) ? conversation.capability : this.capability
        }
        this.capabilitySaved = this.capability
        this.loaded = true
      } finally {
        this.loadingState = false
        this.$nextTick(() => this.scrollToEnd(true))
      }
    },
    async changeCapability() {
      const next = this.capability
      const previous = this.capabilitySaved
      try {
        await aiApi.setCapability(next)
        this.capabilitySaved = next
      } catch (error) {
        this.capability = previous
        this.errorKey = 'ask.error'
      }
    },
    async send() {
      if (!this.canSend) return
      const text = this.draft.trim()
      this.draft = ''
      await this.run(text)
    },
    //The chip re-sends the message that produced this answer with an explicit goal, so the
    //answer is regenerated and the server records that the user chose the mode.
    async changeGoal(message, mode) {
      message.goalOpen = false
      if (this.streaming || !this.enabled || this.quotaReached) return
      const index = this.messages.indexOf(message)
      const source = this.messages.slice(0, index).reverse().find(entry => entry.role === 'user')
      if (!source || !source.content) return
      await this.run(source.content, mode)
    },
    toggleGoal(message) {
      const next = !message.goalOpen
      for (const entry of this.messages) entry.goalOpen = false
      message.goalOpen = next
    },
    async run(text, mode) {
      if (this.streaming || !this.enabled || this.quotaReached) return
      this.errorKey = ''
      this.embedDown = false
      const userMessage = { role: 'user', content: text, citations: [], tools: [], actions: [], stopped: false, empty: false, goal: null, goalOpen: false }
      const assistant = { role: 'assistant', content: '', citations: [], tools: [], actions: [], stopped: false, empty: false, goal: null, goalOpen: false }
      this.messages.push(userMessage, assistant)
      this.thinking = true
      this.streaming = true
      this.controller = new AbortController()
      this.$nextTick(() => this.scrollToEnd(true))

      try {
        await aiApi.streamChat({
          message: text,
          mode,
          capability: this.capability,
          locale: this.locale,
          dishId: this.dishId,
          pantryCount: this.pantry.total,
          signal: this.controller.signal,
          onEvent: event => this.handleEvent(event, assistant)
        })
        if (!assistant.content && !this.errorKey) {
          assistant.empty = true
        }
      } catch (error) {
        if (isAbort(error)) {
          assistant.stopped = true
        } else {
          this.errorKey = errorStateKey(error && error.status, error && error.code)
          if (this.errorKey === 'ask.disabled') this.enabled = false
          if (this.errorKey === 'ask.quotaReached' && this.quota) {
            this.quota = { ...this.quota, remaining: 0 }
          }
        }
      } finally {
        this.thinking = false
        this.streaming = false
        this.controller = null
        this.$nextTick(() => this.scrollToEnd(true))
      }
    },
    handleEvent({ event, data }, assistant) {
      if (event === 'meta') {
        this.embedDown = Boolean(data && data.embed_down)
        assistant.goal = modeChip(data && data.mode, data && data.mode_source)
        return
      }
      if (event === 'token') {
        if (data && data.text) {
          assistant.content += data.text
          this.thinking = false
          this.$nextTick(() => this.scrollToEnd())
        }
        return
      }
      if (event === 'tool') {
        this.thinking = false
        assistant.tools.push({ name: data.name, summary: data.summary || {} })
        assistant.citations = mergeCitations(assistant.citations, data.citations)
        if (data.action) this.addAction(assistant, data.action)
        this.$nextTick(() => this.scrollToEnd())
        return
      }
      if (event === 'done') {
        this.thinking = false
        assistant.citations = mergeCitations(assistant.citations, data && data.citations)
        for (const action of (data && Array.isArray(data.actions) ? data.actions : [])) {
          this.addAction(assistant, action)
        }
        if (data && data.quota) this.quota = data.quota
        return
      }
      if (event === 'error') {
        this.thinking = false
        this.errorKey = errorStateKey(data && data.status, data && data.code)
        if (this.errorKey === 'ask.disabled') this.enabled = false
      }
    },
    addAction(assistant, action) {
      if (!action || typeof action.type !== 'string') return
      const next = { ...action, applied: false }
      const signature = entry => JSON.stringify([entry.type, entry.link || '', entry.items || null, entry.prefill || null])
      if (assistant.actions.some(entry => signature(entry) === signature(next))) return
      if (next.type === 'select_ingredients' && next.apply === true) {
        this.applyIngredients(next)
      }
      assistant.actions.push(next)
    },
    applyIngredients(action) {
      this.pantry.setItems(action.items)
      action.applied = true
    },
    dismissAction(message, index) {
      message.actions.splice(index, 1)
    },
    openDraft(action) {
      const prefill = action.prefill || {}
      const ingredients = Array.isArray(prefill.ingredients) ? prefill.ingredients : []
      action.applied = true
      this.closePanel()
      this.$router.push({
        path: '/dish_edit',
        query: prefill.name ? { prefill_name: prefill.name } : {},
        state: { prefillIngredients: ingredients }
      })
    },
    openDish(action) {
      const link = actionLink(action)
      if (!link) return
      action.applied = true
      this.closePanel()
      this.$router.push(link)
    },
    stop() {
      if (this.controller) this.controller.abort()
    },
    scrollToEnd(force) {
      const list = this.$refs.list
      if (!list) return
      const nearEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 80
      if (force || nearEnd) list.scrollTop = list.scrollHeight
    },
    trapFocus(event) {
      if (event.key !== 'Tab' || !this.$refs.panel) return
      const nodes = this.$refs.panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }
}
</script>

<template>
  <div
    v-if="open"
    class="ask-layer"
    @keydown.esc.stop.prevent="closePanel"
    @keydown.tab="trapFocus"
  >
    <div class="ask-backdrop" @click="closePanel"></div>

    <section
      ref="panel"
      class="ask-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-title"
      tabindex="-1"
    >
      <header class="ask-head">
        <div class="min-w-0">
          <h2 id="ask-title" class="ask-title">{{ t('ask.title') }}</h2>
          <p class="ask-sub">{{ t('ask.subtitle') }}</p>
        </div>
        <button class="btn btn-quiet ask-close" type="button" @click="closePanel">
          {{ t('common.close') }}
        </button>
      </header>

      <div class="ask-controls">
        <label class="ask-capability">
          <span class="eyebrow">{{ t('ask.capabilityLabel') }}</span>
          <select v-model="capability" class="input" :disabled="signedOut || streaming" @change="changeCapability">
            <option v-for="item in capabilities" :key="item" :value="item">
              {{ t('ask.capability.' + item) }}
            </option>
          </select>
        </label>
      </div>

      <p class="ask-privacy">{{ t('ask.privacyNotice') }}</p>

      <div ref="list" class="ask-messages" role="log" aria-live="polite" aria-relevant="additions text">
        <p v-if="loadingState" class="state">{{ t('common.loading') }}</p>

        <div v-else-if="signedOut" class="state ask-state">
          <p>{{ t('ask.signInPrompt') }}</p>
          <router-link class="btn btn-primary mt-3" to="/signin">{{ t('nav.signIn') }}</router-link>
        </div>

        <div v-else-if="loadError" class="state ask-state" role="alert">
          <p>{{ t(loadError) }}</p>
          <button class="btn mt-3" type="button" @click="loadState">{{ t('common.retry') }}</button>
        </div>

        <template v-else>
          <p v-if="messages.length === 0" class="state">{{ t('ask.welcome') }}</p>

          <article
            v-for="(message, index) in messages"
            :key="index"
            class="ask-turn"
            :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
          >
            <p class="eyebrow">{{ message.role === 'user' ? t('ask.you') : t('ask.assistant') }}</p>

            <div v-if="message.goal" class="ask-goal">
              <button
                class="chip ask-goal-toggle"
                type="button"
                :aria-expanded="message.goalOpen"
                :aria-label="t('ask.mode.change') + ': ' + t(message.goal.labelKey)"
                :disabled="streaming"
                @click="toggleGoal(message)"
              >
                {{ t(message.goal.labelKey) }}
                <span class="ask-goal-caret" aria-hidden="true"></span>
              </button>
              <ul v-if="message.goalOpen" class="ask-goal-menu">
                <li v-for="item in modes" :key="item">
                  <button
                    class="chip"
                    :class="{ 'chip-chosen': message.goal.labelKey === 'ask.mode.' + item }"
                    type="button"
                    @click="changeGoal(message, item)"
                  >{{ t('ask.mode.' + item) }}</button>
                </li>
              </ul>
              <p v-if="message.goal.noticeKey" class="ask-note">{{ t(message.goal.noticeKey) }}</p>
            </div>

            <p v-if="message.content" class="ask-text">{{ message.content }}</p>
            <p v-else-if="message.empty" class="ask-note">{{ t('ask.emptyAnswer') }}</p>
            <p
              v-else-if="streaming && index === messages.length - 1"
              class="ask-thinking"
              role="status"
            >{{ t('ask.thinking') }}</p>

            <ul v-if="message.tools.length" class="ask-chips">
              <li v-for="(tool, toolIndex) in message.tools" :key="toolIndex">
                <span class="chip ask-tool">{{ toolLabel(tool) }}</span>
              </li>
            </ul>

            <ul v-if="message.citations.length" class="ask-chips">
              <li v-for="citation in message.citations" :key="citation.target_type + ':' + citation.id">
                <router-link
                  v-if="citationHref(citation)"
                  class="chip"
                  :to="citationHref(citation)"
                >{{ citationName(citation) }}</router-link>
              </li>
            </ul>

            <section v-for="(action, actionIndex) in message.actions" :key="actionIndex" class="ask-card">
              <template v-if="action.type === 'select_ingredients'">
                <h3 class="eyebrow">{{ t('ask.selectTitle') }}</h3>
                <p class="ask-text">{{ ingredientNames(action.items) }}</p>
                <p class="ask-note">{{ t('ask.applyIngredientsHint') }}</p>
                <p v-if="action.applied" class="ask-applied">{{ t('ask.applied') }}</p>
                <div v-else class="ask-card-actions">
                  <button class="btn btn-primary" type="button" @click="applyIngredients(action)">
                    {{ t('ask.applyIngredients') }}
                  </button>
                  <button class="btn btn-quiet" type="button" @click="dismissAction(message, actionIndex)">
                    {{ t('ask.dismiss') }}
                  </button>
                </div>
              </template>

              <template v-else-if="action.type === 'start_draft'">
                <h3 class="eyebrow">{{ t('ask.draftTitle') }}</h3>
                <p v-if="action.prefill && action.prefill.name" class="ask-text">{{ action.prefill.name }}</p>
                <p class="ask-text">{{ ingredientNames(action.prefill && action.prefill.ingredients) }}</p>
                <div class="ask-card-actions">
                  <button class="btn btn-primary" type="button" @click="openDraft(action)">
                    {{ t('ask.openDraft') }}
                  </button>
                  <button class="btn btn-quiet" type="button" @click="dismissAction(message, actionIndex)">
                    {{ t('ask.dismiss') }}
                  </button>
                </div>
              </template>

              <template v-else-if="action.type === 'open_dish'">
                <div class="ask-card-actions">
                  <button v-if="actionLink(action)" class="btn btn-primary" type="button" @click="openDish(action)">
                    {{ t('ask.openDish') }}
                  </button>
                  <button class="btn btn-quiet" type="button" @click="dismissAction(message, actionIndex)">
                    {{ t('ask.dismiss') }}
                  </button>
                </div>
              </template>
            </section>

            <p v-if="message.stopped" class="ask-note">{{ t('ask.stopped') }}</p>
          </article>

          <p v-if="embedDown" class="ask-note">{{ t('ask.embedFallback') }}</p>
          <p v-if="errorKey" class="ask-error" role="alert">{{ t(errorKey) }}</p>
        </template>
      </div>

      <footer v-if="!signedOut" class="ask-compose">
        <label class="sr-only" for="ask-input">{{ t('ask.placeholder') }}</label>
        <textarea
          id="ask-input"
          ref="input"
          v-model="draft"
          class="textarea ask-input"
          rows="2"
          maxlength="2000"
          :placeholder="t('ask.placeholder')"
          :disabled="!enabled || streaming || quotaReached"
          @keydown.enter.exact.prevent="send"
        ></textarea>

        <div class="ask-actions">
          <button v-if="streaming" class="btn" type="button" @click="stop">{{ t('ask.stop') }}</button>
          <button v-else class="btn btn-primary" type="button" :disabled="!canSend" @click="send">
            {{ t('ask.send') }}
          </button>
          <span v-if="quota && !quotaReached" class="ask-quota">{{ t('ask.quotaLeft', { n: quota.remaining }) }}</span>
        </div>

        <p v-if="quotaReached" class="ask-note">
          {{ t('ask.quotaReached') }}
          <span v-if="resetLabel"> {{ t('ask.quotaResets', { time: resetLabel }) }}</span>
        </p>
        <p v-if="!enabled" class="ask-note">{{ t('ask.disabled') }}</p>
      </footer>

      <p v-else class="ask-compose ask-signedout-note">{{ t('ask.signInPrompt') }}</p>
    </section>
  </div>
</template>

<style scoped>
.ask-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.ask-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.ask-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(460px, 100%);
  height: 100dvh;
  max-height: 100dvh;
  border-left: 1px solid var(--board-line);
  background: var(--board-raised);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.35);
  animation: ask-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.ask-panel:focus {
  outline: none;
}

.ask-panel :focus-visible {
  outline: 2px solid var(--board-amber);
  outline-offset: 2px;
}

@keyframes ask-in {
  from { transform: translateX(24px); opacity: 0.7; }
  to { transform: translateX(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .ask-panel { animation: none; }
}

@media (max-width: 639px) {
  .ask-panel {
    width: 100%;
    border-left: 0;
  }
}

.ask-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: max(12px, env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--board-line);
}

.ask-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.ask-sub {
  margin: 4px 0 0;
  color: var(--board-dim);
  font-size: 12px;
  max-width: 42ch;
}

.ask-close {
  flex: 0 0 auto;
}

.ask-controls {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--board-line);
}

.ask-goal {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.ask-goal-caret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
}

.ask-goal-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.ask-capability {
  display: grid;
  gap: 4px;
}

.ask-capability .input {
  font-size: 13px;
  min-height: 34px;
}

.ask-privacy {
  margin: 0;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--board-line);
  color: var(--board-dim);
  font-size: 11px;
  line-height: 1.5;
}

.ask-messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-4);
  scrollbar-color: var(--board-line-strong) transparent;
}

.ask-state {
  padding: var(--space-6) var(--space-3);
}

.ask-turn {
  display: grid;
  gap: 6px;
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--board-line);
}

.ask-turn:last-child {
  margin-bottom: 0;
}

.ask-turn .eyebrow {
  margin: 0;
}

.ask-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
  max-width: 62ch;
}

.is-user .ask-text {
  padding: 8px 10px;
  border: 1px solid var(--board-line);
  border-radius: var(--radius);
  background: var(--board-bg);
}

.ask-note {
  margin: 0;
  color: var(--board-dim);
  font-size: 12px;
  line-height: 1.5;
}

.ask-error {
  margin: 0;
  padding: var(--space-2) 0;
  color: var(--board-danger);
  font-size: 13px;
}

.ask-thinking {
  margin: 0;
  color: var(--board-dim);
  font-size: 13px;
}

.ask-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.ask-tool {
  color: var(--board-dim);
}

.ask-card {
  display: grid;
  gap: 6px;
  padding: var(--space-3);
  margin-top: var(--space-1);
  border: 1px solid var(--board-line);
  border-radius: var(--radius);
  background: var(--board-bg);
}

.ask-card .eyebrow {
  margin: 0;
}

.ask-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ask-applied {
  margin: 0;
  color: var(--board-green);
  font-size: 13px;
}

.ask-compose {
  flex: 0 0 auto;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) max(12px, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--board-line);
}

.ask-input {
  resize: none;
  min-height: 58px;
  max-height: 140px;
}

.ask-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ask-quota {
  margin-left: auto;
  color: var(--board-dim);
  font-size: 12px;
}

.ask-signedout-note {
  margin: 0;
  color: var(--board-dim);
  font-size: 12px;
}
</style>
