<script>
import { useI18n } from '../i18n'

export default {
  computed: {
    t() { return useI18n().t },
    year() { return new Date().getFullYear() }
  }
}
</script>

<template>
  <footer class="border-t mt-10" style="border-color: var(--board-line)">
    <div class="board py-6 grid gap-6 sm:grid-cols-3">
      <div>
        <p class="board-title" style="font-size: 15px">{{ t('common.appName') }}</p>
        <p class="text-sm mt-2" style="color: var(--board-dim)">{{ t('footer.tagline') }}</p>
      </div>

      <nav aria-label="Browse">
        <h2 class="eyebrow mb-2">{{ t('footer.browse') }}</h2>
        <ul class="grid gap-1 text-sm">
          <li><router-link class="link" to="/dishes">{{ t('nav.dishes') }}</router-link></li>
          <li><router-link class="link" to="/homemade">{{ t('nav.homemade') }}</router-link></li>
          <li><router-link class="link" to="/ingredients">{{ t('nav.ingredients') }}</router-link></li>
        </ul>
      </nav>

      <div>
        <h2 class="eyebrow mb-2">{{ t('footer.aboutCol') }}</h2>
        <ul class="grid gap-1 text-sm">
          <li><router-link class="link" to="/about">{{ t('nav.about') }}</router-link></li>
          <li><a class="link" href="https://github.com/doanxem99/What_dish_to_cook_today/blob/main/LICENSE">{{ t('footer.license') }}</a></li>
        </ul>
      </div>
    </div>

    <div class="border-t" style="border-color: var(--board-line)">
      <div class="board py-3 flex flex-wrap items-center justify-between gap-2 text-xs" style="color: var(--board-dim)">
        <span>{{ t('footer.rights', { year: year }) }}</span>
        <span>MIT</span>
      </div>
    </div>
  </footer>
</template>
