import { createApp } from 'vue'
import appVue from './app.vue'
import router from './router'
import { createPinia } from 'pinia'

import FontAwesome from './plugins/fontAwesome'

import './tailwind.css' 
import './assets/css/main.css'

const pinia = createPinia();
const app = createApp(appVue)
        .use(router)
        .use(pinia)
        .component('font-awesome-icon', FontAwesome)
        .mount('#app');