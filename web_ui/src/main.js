import { createApp } from 'vue'
import appVue from './app.vue'
import router from './router'
import { createPinia } from 'pinia'
import { initI18n } from './i18n'
import { initTheme } from './theme'

import FontAwesome from './plugins/fontAwesome'

import './tailwind.css' 
import './assets/css/main.css'
import './assets/css/theme.css'

const pinia = createPinia();

initTheme();
initI18n().then(() => {
  createApp(appVue)
    .use(router)
    .use(pinia)
    .component('font-awesome-icon', FontAwesome)
    .mount('#app');
});