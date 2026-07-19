import 'virtual:uno.css'
import { createApp } from 'vue';
import './style.css';
import 'gz-vue-router/styles/transitions.css';
import { vuetify } from './plugins/vuetify';
import { router } from './router';
import App from './App.vue';

createApp(App).use(vuetify).use(router).mount('#app');
