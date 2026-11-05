import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const config = {
  plugins: [react()],
  server: {
    port: 5173,
    // 백엔드 CORS_ORIGINS(기본 http://localhost:5173)와 출처가 같아야 하므로 다른 포트로 넘어가지 않는다
    strictPort: true,
  },
};

export default defineConfig(({ command, mode }) => {
  // 설계서 6장: 운영 번들이 localhost를 가리키지 않게 API 주소 없이 빌드하지 않는다
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL이 없습니다. frontend/.env에 설정하세요(.env.example 참고).');
  }
  return config;
});
