import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 같은 출처로 API를 부른다(PRD 6장). xfwd로 클라이언트 IP를 X-Forwarded-For에 전달한다(SO-16)
      '/api': { target: 'http://localhost:3000', xfwd: true },
    },
  },
});
