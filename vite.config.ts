import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: 'localhost', // 使用localhost
        // 配置代理到后端API
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
            ws: true, // 支持WebSocket代理
          },
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
      plugins: [react(), tsconfigPaths()],
      css: {
        postcss: {
          plugins: [tailwindcss, autoprefixer],
        },
      },
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