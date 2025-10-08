<script>
import { RouterLink, RouterView } from 'vue-router'
import Navbar from './components/navbar.vue'

export default {
  components: {
    Navbar
  },
}

</script>

<template>
  <div class="flex flex-col">
    <Navbar />
  
    <header class="left-0 right-0 z-10 text-center">
      <p class="large_font_size">What dish to cook today!</p>
      <nav>
        <router-link class="header_menu link_hover" to="/">Home</router-link>
        <router-link class="header_menu link_hover" to="/dishes">Dishes</router-link>
        <router-link class="header_menu link_hover" to="/homemade_dishes">Homemade dishes</router-link>
        <router-link class="header_menu link_hover" to="/ingredients">Ingredients</router-link>
        <router-link class="header_menu link_hover" to="/about">About!</router-link>
      </nav>
    </header>
    <div class="flex-1">
      <router-view />
    </div>
  </div>
</template>