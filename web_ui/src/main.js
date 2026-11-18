import { createApp } from 'vue'
import appVue from './app.vue'
import router from './router'
import { createPinia } from 'pinia'
import { useAuthStore } from './assets/store/auth_store'
import { initI18n } from './i18n'
import { initTheme } from './theme'

import FontAwesome from './plugins/fontAwesome'

import './tailwind.css' 
import './assets/css/main.css'
import './assets/css/theme.css'

const pinia = createPinia();

initTheme();
initI18n().then(async () => {
  const app = createApp(appVue);
  app.use(pinia)
    .use(router)
    .component('font-awesome-icon', FontAwesome);
  //Finish the session read before the first guard run, so a stored admin keeps its panel.
  await useAuthStore(pinia).hydrate();
  app.mount('#app');
});