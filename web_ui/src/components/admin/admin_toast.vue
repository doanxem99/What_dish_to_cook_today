<script setup>
import { useI18n } from '../../i18n'
import { useToasts } from './admin_toast.js'

const { t } = useI18n()
const { items, dismiss } = useToasts()
</script>

<template>
  <div class="admin-toasts" aria-live="polite">
    <p v-for="item in items" :key="item.id" class="admin-toast" :class="'is-' + item.kind">
      <span class="admin-toast-text">{{ item.text }}</span>
      <button class="admin-toast-close" type="button" @click="dismiss(item.id)">
        {{ t('admin.common.close') }}
      </button>
    </p>
  </div>
</template>

<style>
.admin-toasts {
  position: fixed;
  left: var(--space-4);
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 40;
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  pointer-events: none;
}

.admin-toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 62ch;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--board-line-strong);
  border-radius: var(--radius);
  background: var(--board-raised);
  color: var(--board-ink);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  pointer-events: auto;
}

.admin-toast.is-error {
  border-color: var(--board-danger);
  color: var(--board-danger);
}

.admin-toast-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.admin-toast-close {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--board-dim);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  min-height: 30px;
}

.admin-toast-close:focus-visible {
  outline: 2px solid var(--board-amber);
  outline-offset: 2px;
}
</style>
