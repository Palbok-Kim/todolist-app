import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 백엔드 CORS_ORIGINS(기본 http://localhost:5173)와 출처가 같아야 하므로 다른 포트로 넘어가지 않는다
    strictPort: true,
  },
});
