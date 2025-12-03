import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  define: {
    // Polyfill process.env to avoid "process is not defined" error in browser
    'process.env': {}
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
