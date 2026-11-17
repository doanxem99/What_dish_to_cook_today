<script>
import { useI18n } from '../i18n'

export default {
  props: {
    modelValue: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  computed: {
    t() { return useI18n().t }
  },
  methods: {
    copy() { return this.modelValue.map(block => ({ ...block })) },
    updateText(index, key, value) {
      const blocks = this.copy()
      blocks[index][key] = value
      this.$emit('update:modelValue', blocks)
    },
    addText() {
      this.$emit('update:modelValue', [...this.copy(), { type: 'text', text: '', text_vi: '', font_size: 14, color: 'black' }])
    },
    remove(index) {
      const blocks = this.copy()
      blocks.splice(index, 1)
      this.$emit('update:modelValue', blocks)
    },
    move(index, delta) {
      const target = index + delta
      if (target < 0 || target >= this.modelValue.length) return
      const blocks = this.copy()
      const [row] = blocks.splice(index, 1)
      blocks.splice(target, 0, row)
      this.$emit('update:modelValue', blocks)
    }
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div v-for="(block, index) in modelValue" :key="index" class="ruled p-3">
      <template v-if="block.type === 'text'">
        <label class="field">
          <span class="eyebrow">{{ t('edit.blockTextEn') }}</span>
          <textarea
            class="textarea"
            rows="2"
            :value="block.text"
            @input="updateText(index, 'text', $event.target.value)"
          ></textarea>
        </label>
        <label class="field mt-2">
          <span class="eyebrow">{{ t('edit.blockTextVi') }}</span>
          <textarea
            class="textarea"
            rows="2"
            :value="block.text_vi"
            @input="updateText(index, 'text_vi', $event.target.value)"
          ></textarea>
        </label>
      </template>
      <p v-else class="text-sm" style="color: var(--board-dim)">
        {{ t('edit.imageKept') }}
      </p>
      <div class="flex items-center gap-1 mt-2">
        <button
          class="icon-btn"
          type="button"
          :title="t('edit.moveUp')"
          :aria-label="t('edit.moveUp')"
          :disabled="index === 0"
          @click="move(index, -1)"
        ><font-awesome-icon :icon="['fas', 'arrow-up']" /></button>
        <button
          class="icon-btn"
          type="button"
          :title="t('edit.moveDown')"
          :aria-label="t('edit.moveDown')"
          :disabled="index === modelValue.length - 1"
          @click="move(index, 1)"
        ><font-awesome-icon :icon="['fas', 'arrow-down']" /></button>
        <button
          class="icon-btn"
          type="button"
          :title="t('edit.removeBlock')"
          :aria-label="t('edit.removeBlock')"
          @click="remove(index)"
        ><font-awesome-icon :icon="['fas', 'xmark']" /></button>
      </div>
    </div>
    <p v-if="modelValue.length === 0" class="text-sm" style="color: var(--board-dim)">{{ t('edit.noBlocks') }}</p>
    <button class="btn text-xs" type="button" @click="addText">{{ t('edit.addText') }}</button>
  </div>
</template>
