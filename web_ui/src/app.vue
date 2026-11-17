<script>
import Navbar from './components/navbar.vue'
import Footer from './views/footer.vue'
import { useI18n } from './i18n'

export default {
  components: { Navbar, Footer },
  computed: {
    t() { return useI18n().t }
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <a class="skip-link" href="#main">{{ t('common.skip') }}</a>
    <Navbar />
    <main id="main" class="flex-1">
      <router-view />
    </main>
    <Footer />
  </div>
</template>
