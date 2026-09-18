import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * 개발 중에는 프론트(localhost)와 API(운영 서버)의 출처가 다릅니다.
 *
 * 사진을 <img> 로 보여 줄 때는 문제가 없지만, 3D 둘러보기는 사진을 WebGL 텍스처로
 * 쓰기 때문에 CORS 가 없으면 읽지 못합니다. 그래서 개발 서버가 /uploads 요청을
 * 대신 받아 오게 합니다. (운영 빌드는 같은 출처이므로 필요 없습니다)
 */
function devProxy(mode: string) {
  const apiBase = loadEnv(mode, process.cwd(), '').VITE_API_BASE

  if (!apiBase || !/^https?:\/\//.test(apiBase)) return undefined

  return {
    '/uploads': { target: new URL(apiBase).origin, changeOrigin: true },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 1212,
    proxy: devProxy(mode),
  },
}))
