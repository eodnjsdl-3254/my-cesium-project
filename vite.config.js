import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    proxy: {
      '/vworld-bin': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vworld-bin/, ''),
        secure: false,
        headers: {
          // 가이드의 '주의!' 항목: 브라우저 API 사용 시 도메인/Referer 확인 필수
          'Referer': 'http://localhost:5173/', 
          'Origin': 'http://localhost:5173'
        }
      },
      '/osm-tiles': {
        target: 'https://a.tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osm-tiles/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }
    }
  }
})