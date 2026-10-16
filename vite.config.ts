import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { arenaApi } from './server/plugin';

export default defineConfig(({ mode }) => {
  // carrega TODAS as variáveis do .env.local (só no servidor, nunca vão pro navegador)
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), arenaApi(env, process.cwd())],
    server: { port: 5178, host: '127.0.0.1' },
  };
});
