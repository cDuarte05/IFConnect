import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // escuta em todas as interfaces de rede, não só localhost — permite acesso via IP da LAN
    allowedHosts: ['ifconnect.onrender.com'],
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
