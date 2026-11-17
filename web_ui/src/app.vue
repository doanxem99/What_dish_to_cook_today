<script>
import Navbar from './components/navbar.vue'
import Footer from './views/footer.vue'

export default {
  components: { Navbar, Footer }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Navbar />
    <main class="flex-1">
      <router-view />
    </main>
    <Footer />
  </div>
</template>
