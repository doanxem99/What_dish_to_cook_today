<template>
  <section class="board-wrap py-6">
    <p v-if="loading" class="state">{{ t('common.loading') }}</p>
    <p v-else-if="failed" class="state" role="alert">{{ t('cook.loadError') }}</p>

    <template v-else>
      <header class="cook-head">
        <div class="min-w-0">
          <p class="eyebrow">{{ t('cook.title') }}</p>
          <h1 class="board-title">{{ title }}</h1>
        </div>
        <button class="btn btn-quiet" type="button" @click="exit">{{ t('common.close') }}</button>
      </header>

      <p v-if="steps.length === 0" class="state">{{ t('cook.noSteps') }}</p>

      <template v-else>
        <div class="cook-progress">
          <span class="eyebrow">{{ t('cook.step', { n: stepIndex + 1, total: steps.length }) }}</span>
          <span class="cook-bar" aria-hidden="true"><span :style="{ width: progressWidth }"></span></span>
        </div>

        <article class="cook-step" tabindex="-1" ref="stepPanel">
          <p class="cook-text">{{ steps[stepIndex].text }}</p>
        </article>

        <div class="cook-nav">
          <button class="btn" type="button" :disabled="stepIndex === 0" @click="previous">
            {{ t('cook.prev') }}
          </button>
          <button v-if="stepIndex < steps.length - 1" class="btn btn-primary" type="button" @click="next">
            {{ t('cook.next') }}
          </button>
          <button v-else class="btn btn-primary" type="button" @click="finish">
            {{ t('cook.finish') }}
          </button>
        </div>

        <section class="cook-timer" aria-labelledby="cook-timer-title">
          <div class="cook-timer-head">
            <h2 id="cook-timer-title" class="eyebrow">{{ t('cook.timer') }}</h2>
            <output class="cook-remaining" aria-live="polite">{{ remainingLabel }}</output>
          </div>

          <p v-if="timeUp" class="cook-timeup" role="status">{{ t('cook.timeUp') }}</p>

          <div class="cook-presets">
            <button
              v-for="minutes in presets"
              :key="minutes"
              class="chip"
              type="button"
              @click="setMinutes(minutes)"
            >{{ minutes }} {{ t('cook.minutes') }}</button>
            <label class="cook-custom">
              <span class="sr-only">{{ t('cook.custom') }}</span>
              <input
                class="input"
                type="number"
                min="1"
                max="180"
                v-model.number="customMinutes"
                @change="setMinutes(customMinutes)"
              />
              <span class="eyebrow">{{ t('cook.minutes') }}</span>
            </label>
          </div>

          <div class="cook-timer-actions">
            <button v-if="!running" class="btn btn-primary" type="button" :disabled="remaining <= 0" @click="start">
              {{ paused ? t('cook.resume') : t('cook.start') }}
            </button>
            <button v-else class="btn" type="button" @click="pause">{{ t('cook.pause') }}</button>
            <button class="btn btn-quiet" type="button" :disabled="remaining === duration && !running" @click="reset">
              {{ t('cook.reset') }}
            </button>
          </div>
        </section>
      </template>
    </template>
  </section>
</template>

<script>
import api from '../api'
import { useI18n } from '../i18n'
import { useAuthStore } from '../assets/store/auth_store'
import { stepsFor, formatClock } from '../components/cook_steps'

const PRESETS = [5, 10, 15]

export default {
  name: 'cook_view',
  data() {
    return {
      loading: true,
      failed: false,
      dish: null,
      post: null,
      stepIndex: 0,
      presets: PRESETS,
      duration: 600,
      remaining: 600,
      running: false,
      paused: false,
      customMinutes: 10,
      timeUp: false,
      intervalId: null,
      audioContext: null,
      previousTitle: ''
    }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value },
    auth() { return useAuthStore() },
    dishId() { return this.$route.params.dishId },
    title() {
      if (!this.post) return ''
      return this.locale === 'vi' && this.post.name_vi ? this.post.name_vi : this.post.name
    },
    steps() {
      if (!this.post) return []
      return stepsFor(this.post, this.locale).map((text, index) => ({ text, index }))
    },
    progressWidth() {
      if (this.steps.length === 0) return '0%'
      return `${Math.round(((this.stepIndex + 1) / this.steps.length) * 100)}%`
    },
    remainingLabel() { return formatClock(this.remaining) }
  },
  watch: {
    locale() { this.stepIndex = 0 }
  },
  mounted() {
    this.load()
    window.addEventListener('keydown', this.onKey)
    this.previousTitle = document.title
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
    this.clearTick()
    document.title = this.previousTitle
    this.closeAudio()
  },
  methods: {
    async load() {
      this.loading = true
      this.failed = false
      try {
        const detail = await api.get(`/api/dish/profile/get_dish/${this.dishId}`)
        this.dish = detail && detail.data ? detail.data : null
        const postId = this.dish && this.dish.best_post_id
        if (!postId) throw new Error('no best post')
        const post = await api.get(`/api/dish/profile/get_dish_post/${postId}`)
        this.post = post && post.data ? post.data : null
        this.stepIndex = 0
      } catch (error) {
        this.failed = true
      } finally {
        this.loading = false
      }
    },
    exit() {
      if (window.history.length > 1) {
        this.$router.back()
        return
      }
      this.$router.push('/dishes')
    },
    previous() {
      if (this.stepIndex > 0) this.stepIndex -= 1
      this.focusStep()
    },
    next() {
      if (this.stepIndex < this.steps.length - 1) this.stepIndex += 1
      this.focusStep()
    },
    focusStep() {
      this.$nextTick(() => {
        if (this.$refs.stepPanel) this.$refs.stepPanel.focus()
      })
    },
    async finish() {
      if (this.auth.isLogin && this.dish) {
        try {
          await api.post('/api/ai/events', { type: 'dish_cooked', target_id: this.dish._id || this.dishId })
        } catch (error) {
          //The walkthrough still ends; recording is best effort.
        }
      }
      this.$router.push({ path: '/dish_detail', query: { dish_id: this.dishId } })
    },
    setMinutes(minutes) {
      const value = Math.max(1, Math.min(180, Number(minutes) || 1))
      this.customMinutes = value
      this.clearTick()
      this.running = false
      this.paused = false
      this.timeUp = false
      this.duration = value * 60
      this.remaining = this.duration
    },
    start() {
      if (this.remaining <= 0) return
      this.timeUp = false
      this.running = true
      this.paused = false
      this.tick()
      this.intervalId = setInterval(this.tick, 1000)
    },
    pause() {
      this.running = false
      this.paused = true
      this.clearTick()
    },
    reset() {
      this.clearTick()
      this.running = false
      this.paused = false
      this.timeUp = false
      this.remaining = this.duration
      document.title = this.previousTitle
    },
    tick() {
      if (!this.running) return
      this.remaining = Math.max(0, this.remaining - 1)
      document.title = `${this.remainingLabel} · ${this.title}`
      if (this.remaining === 0) {
        this.running = false
        this.timeUp = true
        this.clearTick()
        this.beep()
        document.title = this.previousTitle
      }
    },
    clearTick() {
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = null
      }
    },
    beep() {
      try {
        const Context = window.AudioContext || window.webkitAudioContext
        if (!Context) return
        this.audioContext = this.audioContext || new Context()
        const oscillator = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        oscillator.frequency.value = 880
        gain.gain.value = 0.15
        oscillator.connect(gain)
        gain.connect(this.audioContext.destination)
        oscillator.start()
        oscillator.stop(this.audioContext.currentTime + 0.6)
      } catch (error) {
        //Silent fallback: the timer still shows time up.
      }
    },
    closeAudio() {
      if (this.audioContext && this.audioContext.close) {
        this.audioContext.close().catch(() => {})
        this.audioContext = null
      }
    },
    onKey(event) {
      if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); this.previous() }
      if (event.key === 'ArrowRight') { event.preventDefault(); this.next() }
      if (event.key === ' ') {
        event.preventDefault()
        if (this.running) this.pause()
        else if (this.remaining > 0) this.start()
      }
    }
  }
}
</script>

<style scoped>
.cook-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.cook-progress { display: grid; gap: 6px; margin: 16px 0 8px; }
.cook-bar { display: block; height: 3px; background: var(--board-line); }
.cook-bar > span { display: block; height: 3px; background: var(--board-amber); transition: width 160ms ease; }
.cook-step { min-height: 180px; padding: 16px; border: 1px solid var(--board-line); border-radius: var(--radius); background: var(--board-raised); outline: none; }
.cook-step:focus-visible { box-shadow: 0 0 0 2px var(--board-amber); }
.cook-text { font-size: 20px; line-height: 1.55; }
.cook-nav { display: flex; gap: 8px; margin-top: 12px; }
.cook-timer { margin-top: 24px; padding: 14px; border: 1px solid var(--board-line); border-radius: var(--radius); }
.cook-timer-head { display: flex; align-items: baseline; justify-content: space-between; }
.cook-remaining { font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 800; }
.cook-timeup { color: var(--board-green); font-size: 14px; }
.cook-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0; }
.cook-custom { display: inline-flex; gap: 6px; align-items: center; }
.cook-custom .input { width: 84px; }
.cook-timer-actions { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 639px) {
  .cook-text { font-size: 18px; }
  .cook-nav .btn, .cook-timer-actions .btn { flex: 1 1 auto; }
}
</style>
