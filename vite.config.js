import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    host: '0.0.0.0', // 모든 IP에서의 접근 허용 (필수!)
    port: 5173,      // 포트 고정
    hmr: {
        clientPort: 80 // Nginx(80)를 거쳐서 오므로 HMR(새로고침) 포트도 맞춰줌
    },
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
      '/vworld-data': {
        target: 'https://xdworld.vworld.kr', // 3D 데이터 서버
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vworld-data/, ''),
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Referer', 'https://map.vworld.kr/');
            proxyReq.setHeader('Origin', 'https://map.vworld.kr');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
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