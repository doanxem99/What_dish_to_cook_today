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
  <footer class="site-footer border-t mt-10" style="border-color: var(--board-line)">
    <div class="board footer-cols grid gap-8 sm:grid-cols-3">
      <div>
        <p class="board-title" style="font-size: 15px">{{ t('common.appName') }}</p>
        <p class="footer-tagline" style="color: var(--board-dim)">{{ t('footer.tagline') }}</p>
      </div>

      <nav aria-label="Browse">
        <h2 class="eyebrow">{{ t('footer.browse') }}</h2>
        <ul>
          <li><router-link class="link" to="/dishes">{{ t('nav.dishes') }}</router-link></li>
          <li><router-link class="link" to="/homemade">{{ t('nav.homemade') }}</router-link></li>
          <li><router-link class="link" to="/ingredients">{{ t('nav.ingredients') }}</router-link></li>
        </ul>
      </nav>

      <div>
        <h2 class="eyebrow">{{ t('footer.aboutCol') }}</h2>
        <ul>
          <li><router-link class="link" to="/about">{{ t('nav.about') }}</router-link></li>
          <li><a class="link" href="https://github.com/doanxem99/What_dish_to_cook_today/blob/main/LICENSE">{{ t('footer.license') }}</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="board footer-bottom-row">
        <span>{{ t('footer.rights', { year: year }) }}</span>
        <span>MIT</span>
      </div>
    </div>
  </footer>
</template>
