<script>
import { useI18n } from '../i18n'

export default {
  computed: {
    t() { return useI18n().t }
  }
}
</script>

<template>
  <section class="board board-narrow py-6">
    <h1 class="board-title">{{ t('about.title') }}</h1>
    <div class="mt-6 grid gap-4 leading-relaxed">
      <p>{{ t('about.body1') }}</p>
      <p>{{ t('about.body2') }}</p>
      <p>{{ t('about.body3') }}</p>
      <p>{{ t('about.body4') }}</p>
    </div>
  </section>
</template>
