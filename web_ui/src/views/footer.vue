<script>
import { useI18n } from '../i18n'

export default {
  computed: {
    t() { return useI18n().t }
  }
}
</script>

<template>
  <footer class="border-t mt-10" style="border-color: var(--board-line)">
    <div class="board py-6 text-sm" style="color: var(--board-dim)">
      <p>{{ t('common.appName') }}</p>
    </div>
  </footer>
</template>
