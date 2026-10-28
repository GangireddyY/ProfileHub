import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const API_TARGET = env.VITE_API_TARGET || 'http://localhost:4000';

  return {
    // `--mode lan` serves over HTTPS (self-signed) so phones on the same Wi-Fi can use geolocation.
    plugins: mode === 'lan' ? [vue(), basicSsl()] : [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: API_TARGET, changeOrigin: true },
        '/uploads': { target: API_TARGET, changeOrigin: true },
        '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true },
      },
    },
  };
});
