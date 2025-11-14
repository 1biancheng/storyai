import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '127.0.0.1', // 修改为127.0.0.1避免VS Code端口转发问题
        // 配置代理到后端API
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
            ws: true, // 支持WebSocket代理
          },
        },
        // 配置HMR,防止WebSocket断连导致整页刷新
        hmr: {
          protocol: 'ws',
          host: '127.0.0.1',
          port: 3000,
          clientPort: 3000,
        },
        // 配置文件监听,排除后端目录和非前端文件
        watch: {
          ignored: [
            '**/backend/**',
            '**/*.py',
            '**/*.pyc',
            '**/*.sql',
            '**/*.log',
            '**/.qoder/**',
            '**/.pytest_cache/**',
            '**/uploads/**',
            '**/workspace/**',
            '**/__pycache__/**',
          ],
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
