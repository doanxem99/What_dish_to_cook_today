<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="header_view">
    <p class="large_font_size">What dish to cook today!</p>
    <nav>
      <router-link class="header_menu link_hover" to="/">Home</router-link>
      <router-link class="header_menu link_hover" to="/dishes">Dishes</router-link>
      <router-link class="header_menu link_hover" to="/homemade_dishes">Homemade dishes</router-link>
      <router-link class="header_menu link_hover" to="/ingredients">Ingredients</router-link>
      <!--<router-link class="header_menu link_hover" to="/live_stream">Live stream</router-link>-->
      <router-link class="header_menu link_hover" to="/about">About!</router-link>
    </nav>
  </header>
  <RouterView />
</template>