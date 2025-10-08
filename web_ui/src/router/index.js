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
      component: () => import('../views/ingredient_detail_view.vue')
    },
    {
      path: '/ingredient_edit',
      name: 'ingredient_edit',
      component: () => import('../views/ingredient_edit_view.vue')
    },
    {
      path: '/dishes',
      name: 'dishes',
      component: () => import('../views/dishes_view.vue')
    },
    {
      path: '/dish_selection',
      name: 'dish_selection',
      component: () => import('../views/dish_selection_view.vue')
    },
    {
      path: '/dish_detail',
      name: 'dish_detail',
      component: () => import('../views/dish_detail_view.vue')
    },
    {
      path: '/dish_edit',
      name: 'dish_edit',
      component: () => import('../views/dish_edit_view.vue')
    },
    {
      path: '/homemade_dishes',
      name: 'homemade_dishes',
      component: () => import('../views/homemade_dishes_view.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/about_view.vue')
    },
    {
      path: '/signin',
      name: 'signin',
      component: () => import('../views/signin_view.vue')
    },
    {
      path: '/signup', 
      name: 'signup',
      component: () => import('../views/signup_view.vue')
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/profile_view.vue'),
      meta: {
        requiresAuth: true
      }
    }
  ]
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const token = Cookies.get('token')
    if (token) {
      next();
    } else {
      next('/signin');
    }
  }
  else {
    next();
  }
})

export default router
