import { defineConfig } from 'vite'

// A página de instalação (site/), publicada no GitHub Pages em /codorna-card/.
// base "./" deixa os caminhos relativos: funciona no Pages e aberta localmente.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: {
    outDir: '../site-dist',
    emptyOutDir: true,
  },
  server: {
    fs: { allow: ['..'] },
  },
})
