import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../assets/store/auth_store'
import { guardDecision } from '../components/admin/admin_guard'
import { t } from '../i18n'
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
      redirect: '/'
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
      path: '/homemade',
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
    },
    {
      path: '/change-password',
      name: 'change_password',
      component: () => import('../views/change_password_view.vue')
    },
    {
      path: '/admin',
      component: () => import('../views/admin/admin_layout.vue'),
      meta: {
        requiresAdmin: true
      },
      children: [
        {
          path: '',
          name: 'admin_overview',
          component: () => import('../views/admin/admin_overview.vue')
        }
      ]
    }
  ]
})

const titleKeys = {
  home: 'nav.home',
  dishes: 'nav.dishes',
  dish_detail: 'nav.dishes',
  dish_edit: 'common.edit',
  ingredients: 'nav.ingredients',
  ingredient_detail: 'nav.ingredients',
  ingredient_edit: 'common.edit',
  homemade_dishes: 'nav.homemade',
  about: 'nav.about',
  signin: 'nav.signIn',
  signup: 'nav.signUp',
  profile: 'nav.profile',
  change_password: 'admin.password.title',
  admin_overview: 'admin.title'
}

router.afterEach((to) => {
  const key = titleKeys[to.name]
  document.title = key ? `${t(key)} · ${t('common.appName')}` : t('common.appName')
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  const decision = guardDecision(
    { isLogin: auth.isLogin, isAdmin: auth.isAdmin, mustChange: auth.mustChange },
    to
  )
  if (decision === 'allow' || decision === 'forbidden') {
    return next()
  }
  if (decision.remember) {
    auth.jumpPage = to.fullPath
  }
  return next(decision.redirect)
})

export default router
