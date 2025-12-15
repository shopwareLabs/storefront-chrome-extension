import { createApp } from "vue";
import App from "./App.vue";
import "@shopware-ag/meteor-component-library/styles.css";
import "@shopware-ag/meteor-component-library/font.css";

// Initialize Vue app
const app = createApp(App);
app.mount("#app");
