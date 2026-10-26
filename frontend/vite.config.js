import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';



export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), ''); // Importa as variáveis de ambiente do render

  return {
      plugins: [react()],
      server: {
      port: Number(env.PORT) || 5173, // Usa a variável de ambiente do render
      host: true, // escuta em todas as interfaces de rede, não só localhost — permite acesso via IP da LAN
      allowedHosts: ['ifconnect.onrender.com'],
      proxy: {
        '/api': 'http://localhost:4000',
      },
    },
  }
});
