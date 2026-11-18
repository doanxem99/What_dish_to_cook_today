<script setup>
import { nextTick, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { typedWordMatches } from './admin_format.js'

//One dialog for every decision in the admin area. `word` turns it into a typed confirmation.
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  word: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['close', 'confirm'])
const { t } = useI18n()

const panel = ref(null)
const typed = ref('')

function matches() {
  return !props.word || typedWordMatches(typed.value, props.word)
}

//The native dialog owns the focus trap and the Escape key; the watcher only opens and closes it.
watch(() => props.open, async (open) => {
  const dialog = panel.value
  if (!dialog) {
    return
  }
  if (open) {
    typed.value = ''
    if (!dialog.open) {
      dialog.showModal()
    }
    await nextTick()
    const input = dialog.querySelector('input')
    if (input) {
      input.focus()
    }
    return
  }
  if (dialog.open) {
    dialog.close()
  }
})

function submit() {
  if (props.busy || !matches()) {
    return
  }
  emit('confirm')
}
</script>

<template>
  <dialog ref="panel" class="admin-dialog" :aria-label="title" @cancel.prevent="emit('close')" @close="emit('close')">
    <form class="admin-dialog-body" @submit.prevent="submit">
      <h2 class="admin-dialog-title">{{ title }}</h2>
      <p v-if="body" class="admin-dialog-copy measure">{{ body }}</p>

      <label v-if="word" class="field admin-dialog-word">
        <span class="admin-dialog-hint">{{ t('admin.dialog.typedLabel', { word }) }}</span>
        <input
          v-model="typed"
          class="input"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
      </label>

      <p v-if="error" class="admin-dialog-error" role="alert">{{ error }}</p>

      <div class="admin-dialog-actions">
        <button class="btn btn-quiet" type="button" :disabled="busy" @click="emit('close')">
          {{ t('admin.common.cancel') }}
        </button>
        <button class="btn btn-primary" type="submit" :disabled="busy || !matches()">
          {{ busy ? t('admin.common.working') : (confirmLabel || t('admin.common.confirm')) }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style>
.admin-dialog {
  width: min(460px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--board-line-strong);
  border-radius: var(--radius);
  background: var(--board-raised);
  color: var(--board-ink);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.admin-dialog::backdrop {
  background: rgba(0, 0, 0, 0.62);
}

.admin-dialog-body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.admin-dialog-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
}

.admin-dialog-copy {
  margin: 0;
  color: var(--board-dim);
  font-size: 13px;
}

.admin-dialog-word {
  gap: var(--space-1);
}

.admin-dialog-hint {
  font-size: 12px;
  color: var(--board-dim);
}

.admin-dialog-error {
  margin: 0;
  color: var(--board-danger);
  font-size: 13px;
}

.admin-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

@media (max-width: 639px) {
  .admin-dialog-body {
    padding: var(--space-4);
  }
  .admin-dialog-actions {
    flex-direction: column-reverse;
  }
  .admin-dialog-actions .btn {
    width: 100%;
  }
}
</style>
