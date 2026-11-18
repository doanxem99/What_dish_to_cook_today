<script>
import { useI18n } from '../i18n'
import { api } from '../api'
import { shouldApplyTranslation, translationFailureFor } from './translation_error.js'

let blockSeq = 0
const newBlockId = () => 'block-' + (++blockSeq)

export default {
  props: {
    modelValue: { type: Array, default: () => [] },
    autoTranslate: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  data() {
    return { uploading: false, uploadError: false, translateErrors: {}, blockIds: [] }
  },
  computed: {
    t() { return useI18n().t }
  },
  watch: {
    autoTranslate(on) { if (!on) this.translateErrors = {} },
    modelValue(blocks) { this.syncIds(blocks) }
  },
  created() {
    this.syncIds(this.modelValue)
  },
  methods: {
    //shortcut: ids rebuild when the parent replaces the list with a different length, upgrade if a second surface edits the same list
    syncIds(blocks) {
      if (this.blockIds.length === blocks.length) return
      this.blockIds = blocks.map(() => newBlockId())
      this.translateErrors = {}
    },
    copy() { return this.modelValue.map(block => ({ ...block })) },
    emit(blocks) { this.$emit('update:modelValue', blocks) },
    updateText(index, key, value) {
      const blocks = this.copy()
      blocks[index][key] = value
      this.emit(blocks)
    },
    async translateBlock(index, fromKey, toKey) {
      if (!this.autoTranslate) return
      const block = this.modelValue[index]
      if (!block) return
      const id = this.blockIds[index]
      const source = block[fromKey]
      const target = block[toKey]
      const direction = fromKey === 'text' ? 'enToVi' : 'viToEn'
      if (!source || !source.trim() || (target && target.trim())) return
      try {
        const response = await api.post('/api/translate', {
          text: source,
          source: fromKey === 'text' ? 'en' : 'vi',
          target: fromKey === 'text' ? 'vi' : 'en'
        })
        if (!this.autoTranslate) return
        //The block can be edited, reordered or removed while the request runs
        const currentIndex = this.blockIds.indexOf(id)
        if (currentIndex < 0) return
        const current = this.modelValue[currentIndex]
        if (!current || !shouldApplyTranslation({
          currentSource: current[fromKey],
          requestSource: source,
          currentTarget: current[toKey]
        })) return
        const blocks = this.copy()
        blocks[currentIndex][toKey] = response.text
        delete this.translateErrors[id]
        this.emit(blocks)
      } catch (error) {
        //Leave the target empty; the editor still saves what was typed
        const reason = translationFailureFor(id, this.blockIds, error && error.status)
        if (!this.autoTranslate || !reason) return
        this.translateErrors[id] = { reason, direction }
      }
    },
    setStyle(index, key, value) {
      const blocks = this.copy()
      blocks[index][key] = value
      this.emit(blocks)
    },
    toggleStyle(index, key, onValue, offValue) {
      const blocks = this.copy()
      blocks[index][key] = blocks[index][key] === onValue ? offValue : onValue
      this.emit(blocks)
    },
    addText() {
      this.blockIds.push(newBlockId())
      this.emit([...this.copy(), {
        type: 'text', text: '', text_vi: '', font_size: 14, color: 'black',
        font_weight: 'normal', font_style: 'normal', text_align: 'left'
      }])
    },
    async addImages(event) {
      const files = [...(event.target.files || [])]
      if (files.length === 0) return
      this.uploading = true
      this.uploadError = false
      const blocks = this.copy()
      try {
        for (const file of files) {
          const form = new FormData()
          form.append('file', file)
          const response = await fetch('/api/gallery_upload/temporary', { method: 'POST', credentials: 'include', body: form })
          const data = await response.json()
          if (data && data.isSuccess) {
            blocks.push({ type: 'image', src: data.path, text: '', text_vi: '', font_size: 14, color: 'black' })
            this.blockIds.push(newBlockId())
          } else {
            this.uploadError = true
          }
        }
        this.emit(blocks)
      } catch (error) {
        this.uploadError = true
      } finally {
        this.uploading = false
        if (event.target) event.target.value = ''
      }
    },
    remove(index) {
      const blocks = this.copy()
      blocks.splice(index, 1)
      const [id] = this.blockIds.splice(index, 1)
      delete this.translateErrors[id]
      this.emit(blocks)
    },
    move(index, delta) {
      const target = index + delta
      if (target < 0 || target >= this.modelValue.length) return
      const blocks = this.copy()
      const [row] = blocks.splice(index, 1)
      blocks.splice(target, 0, row)
      const [id] = this.blockIds.splice(index, 1)
      this.blockIds.splice(target, 0, id)
      this.emit(blocks)
    },
    imageSrc(src) {
      return src && src.startsWith('public/') ? '/' + src : src
    }
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div v-for="(block, index) in modelValue" :key="blockIds[index] || index" class="ruled p-3">
      <template v-if="block.type === 'text'">
        <div class="block-toolbar">
          <button
            class="icon-btn" :class="{ 'is-active': block.font_weight === 'bold' }" type="button"
            :title="t('edit.bold')" :aria-label="t('edit.bold')" :aria-pressed="block.font_weight === 'bold'"
            @click="toggleStyle(index, 'font_weight', 'bold', 'normal')"
          ><font-awesome-icon :icon="['fas', 'bold']" /></button>
          <button
            class="icon-btn" :class="{ 'is-active': block.font_style === 'italic' }" type="button"
            :title="t('edit.italic')" :aria-label="t('edit.italic')" :aria-pressed="block.font_style === 'italic'"
            @click="toggleStyle(index, 'font_style', 'italic', 'normal')"
          ><font-awesome-icon :icon="['fas', 'italic']" /></button>
          <select class="input tiny" :value="block.font_size || 14" :aria-label="t('edit.textSize')"
            @change="setStyle(index, 'font_size', Number($event.target.value))">
            <option :value="12">12</option>
            <option :value="14">14</option>
            <option :value="18">18</option>
            <option :value="24">24</option>
          </select>
          <select class="input tiny" :value="block.color || 'black'" :aria-label="t('edit.textColor')"
            @change="setStyle(index, 'color', $event.target.value)">
            <option value="black">Black</option>
            <option value="white">White</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
          </select>
          <span class="flex gap-1">
            <button class="icon-btn" :class="{ 'is-active': (block.text_align || 'left') === 'left' }" type="button"
              :title="t('edit.alignLeft')" :aria-label="t('edit.alignLeft')" @click="setStyle(index, 'text_align', 'left')"
            ><font-awesome-icon :icon="['fas', 'align-left']" /></button>
            <button class="icon-btn" :class="{ 'is-active': block.text_align === 'center' }" type="button"
              :title="t('edit.alignCenter')" :aria-label="t('edit.alignCenter')" @click="setStyle(index, 'text_align', 'center')"
            ><font-awesome-icon :icon="['fas', 'align-center']" /></button>
            <button class="icon-btn" :class="{ 'is-active': block.text_align === 'right' }" type="button"
              :title="t('edit.alignRight')" :aria-label="t('edit.alignRight')" @click="setStyle(index, 'text_align', 'right')"
            ><font-awesome-icon :icon="['fas', 'align-right']" /></button>
          </span>
        </div>
        <label class="field mt-2">
          <span class="eyebrow">{{ t('edit.blockTextEn') }}</span>
          <textarea class="textarea" rows="2" :value="block.text" @input="updateText(index, 'text', $event.target.value)" @blur="translateBlock(index, 'text', 'text_vi')"></textarea>
        </label>
        <label class="field mt-2">
          <span class="eyebrow">{{ t('edit.blockTextVi') }}</span>
          <textarea class="textarea" rows="2" :value="block.text_vi" @input="updateText(index, 'text_vi', $event.target.value)" @blur="translateBlock(index, 'text_vi', 'text')"></textarea>
        </label>
        <p v-if="translateErrors[blockIds[index]]" class="text-sm mt-2" role="alert" style="color: var(--board-danger)">
          {{ t('edit.translate.' + translateErrors[blockIds[index]].direction) }}: {{ t(translateErrors[blockIds[index]].reason) }}
        </p>
      </template>

      <template v-else>
        <img v-if="block.src" class="w-full max-h-48 object-cover rounded" :src="imageSrc(block.src)" alt="" />
        <div class="grid gap-2 sm:grid-cols-2 mt-2">
          <label class="field">
            <span class="eyebrow">{{ t('edit.imageCaptionEn') }}</span>
            <input class="input" :value="block.text" @input="updateText(index, 'text', $event.target.value)" />
          </label>
          <label class="field">
            <span class="eyebrow">{{ t('edit.imageCaptionVi') }}</span>
            <input class="input" :value="block.text_vi" @input="updateText(index, 'text_vi', $event.target.value)" />
          </label>
        </div>
      </template>

      <div class="flex items-center gap-1 mt-2">
        <button class="icon-btn" type="button" :title="t('edit.moveUp')" :aria-label="t('edit.moveUp')" :disabled="index === 0" @click="move(index, -1)"><font-awesome-icon :icon="['fas', 'arrow-up']" /></button>
        <button class="icon-btn" type="button" :title="t('edit.moveDown')" :aria-label="t('edit.moveDown')" :disabled="index === modelValue.length - 1" @click="move(index, 1)"><font-awesome-icon :icon="['fas', 'arrow-down']" /></button>
        <button class="icon-btn" type="button" :title="t('edit.removeBlock')" :aria-label="t('edit.removeBlock')" @click="remove(index)"><font-awesome-icon :icon="['fas', 'xmark']" /></button>
      </div>
    </div>

    <p v-if="modelValue.length === 0" class="text-sm" style="color: var(--board-dim)">{{ t('edit.noBlocks') }}</p>

    <div class="flex flex-wrap items-center gap-2">
      <button class="btn text-xs" type="button" @click="addText">{{ t('edit.addText') }}</button>
      <label class="btn text-xs" style="cursor: pointer">
        {{ uploading ? t('common.loading') : t('edit.addImageBlock') }}
        <input class="sr-only" type="file" accept="image/png,image/jpeg" multiple @change="addImages" />
      </label>
    </div>
    <p v-if="uploadError" class="text-sm" role="alert" style="color: var(--board-danger)">{{ t('common.errorBody') }}</p>
  </div>
</template>
