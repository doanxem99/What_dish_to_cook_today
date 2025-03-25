import { createRouter, createWebHistory } from 'vue-router'
import homeView from '../views/home_view.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: homeView
    },
    {
      path: '/ingredients',
      name: 'ingredients',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/ingredients_view.vue')
    },
    {
      path: '/ingredient_detail',
      name: 'ingredient_detail',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/ingredient_detail_view.vue')
    },
    {
      path: '/ingredient_edit',
      name: 'ingredient_edit',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/ingredient_edit_view.vue')
    },
    {
      path: '/dishes',
      name: 'dishes',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/dishes_view.vue')
    },
    {
      path: '/dish_selection',
      name: 'dish_selection',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/dish_selection_view.vue')
    },
    {
      path: '/dish_detail',
      name: 'dish_detail',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/dish_detail_view.vue')
    },
  ]
})

export default router
