<script>
import { api } from '../api'
import { useI18n } from '../i18n'

export default {
  props: {
    modelValue: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  data() {
    return { q: '', found: [], timer: null }
  },
  computed: {
    t() { return useI18n().t },
    locale() { return useI18n().locale.value }
  },
  beforeUnmount() { clearTimeout(this.timer) },
  methods: {
    localName(item) {
      return (this.locale === 'vi' && item.name_vi) ? item.name_vi : item.name
    },
    queue() {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.search(), 250)
    },
    async search() {
      const term = this.q.trim()
      if (!term) { this.found = []; return }
      try {
        const rows = await api.get(`/api/ingredient/search/keyword/${encodeURIComponent(term)}`)
        this.found = Array.isArray(rows) ? rows : []
      } catch (error) {
        this.found = []
      }
    },
    add(item) {
      if (this.modelValue.some(entry => entry.id === item.id)) return
      this.$emit('update:modelValue', [...this.modelValue, { id: item.id, name: item.name, name_vi: item.name_vi || null }])
    },
    remove(item) {
      this.$emit('update:modelValue', this.modelValue.filter(entry => entry.id !== item.id))
    }
  }
}
</script>

<template>
  <div>
    <div v-if="modelValue.length" class="flex flex-wrap gap-2 mb-2">
      <span v-for="item in modelValue" :key="item.id" class="chip">
        {{ localName(item) }}
        <button class="chip-remove" type="button" :aria-label="t('common.delete') + ' ' + localName(item)" @click="remove(item)">×</button>
      </span>
    </div>
    <label class="sr-only" for="editor-ingredient-search">{{ t('edit.ingredients') }}</label>
    <input
      id="editor-ingredient-search"
      v-model="q"
      class="input"
      type="search"
      :placeholder="t('home.pickerPlaceholder')"
      @input="queue"
    />
    <div v-if="found.length" class="flex flex-wrap gap-2 mt-2">
      <button v-for="item in found" :key="item.id" class="chip" type="button" @click="add(item)">
        + {{ localName(item) }}
      </button>
    </div>
  </div>
</template>
