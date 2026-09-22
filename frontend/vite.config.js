import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // encaminha chamadas /api para o backend local durante o desenvolvimento
      '/api': 'http://localhost:4000',
    },
  },
});
