import { createApp } from 'vue'
import appVue from './app.vue'
import router from './router'

import './assets/css/main.css'

const app = createApp(appVue)

app.use(router)

app.mount('#app')
