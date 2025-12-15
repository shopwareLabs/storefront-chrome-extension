import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/icon.png', dest: '.' },
        { src: 'src/devtools.html', dest: '.' },
        { src: 'src/panels/storefront/panel.html', dest: 'panels/storefront' },
        { 
          src: 'src/panels/storefront/scripts/*.js',
          dest: 'panels/storefront/scripts'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'devtools': resolve(__dirname, 'src/devtools.js'),
        'background': resolve(__dirname, 'src/background.js'),
        'action': resolve(__dirname, 'src/action.js'),
        'panels/storefront/storefront-panel': resolve(__dirname, 'src/panels/storefront/storefront-panel.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Use predictable filename for CSS files from the storefront panel
          if (assetInfo.name === 'storefront-panel.css') {
            return 'assets/storefront-panel.css';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  }
});