// vite.config.ts
import path from "path";
import { defineConfig, loadEnv } from "file:///D:/story-ai%20(3)/node_modules/vite/dist/node/index.js";
import react from "file:///D:/story-ai%20(3)/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///D:/story-ai%20(3)/node_modules/vite-tsconfig-paths/dist/index.mjs";
import tailwindcss from "file:///D:/story-ai%20(3)/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///D:/story-ai%20(3)/node_modules/autoprefixer/lib/autoprefixer.js";
var __vite_injected_original_dirname = "D:\\story-ai (3)";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 300,
      host: "127.0.0.1",
      // 修改为127.0.0.1避免VS Code端口转发问题
      // 配置代理到后端API
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
          secure: false,
          ws: true
          // 支持WebSocket代理
        }
      },
      // 配置文件监听,排除后端目录和非前端文件
      watch: {
        ignored: [
          "**/backend/**",
          "**/*.py",
          "**/*.pyc",
          "**/*.sql",
          "**/*.log",
          "**/.qoder/**",
          "**/.pytest_cache/**",
          "**/uploads/**",
          "**/workspace/**",
          "**/__pycache__/**"
        ]
      }
    },
    plugins: [react(), tsconfigPaths()],
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer]
      }
    },
    define: {
      "process.env.API_KEY": JSON.stringify(env.OPENAI_API_KEY),
      "process.env.OPENAI_API_KEY": JSON.stringify(env.OPENAI_API_KEY)
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, ".")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzdG9yeS1haSAoMylcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHN0b3J5LWFpICgzKVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovc3RvcnktYWklMjAoMykvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnO1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAndGFpbHdpbmRjc3MnO1xyXG5pbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gJ2F1dG9wcmVmaXhlcic7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsICcuJywgJycpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VydmVyOiB7XHJcbiAgICAgICAgcG9ydDogMzAwLFxyXG4gICAgICAgIGhvc3Q6ICcxMjcuMC4wLjEnLCAvLyBcdTRGRUVcdTY1MzlcdTRFM0ExMjcuMC4wLjFcdTkwN0ZcdTUxNERWUyBDb2RlXHU3QUVGXHU1M0UzXHU4RjZDXHU1M0QxXHU5NUVFXHU5ODk4XHJcbiAgICAgICAgLy8gXHU5MTREXHU3RjZFXHU0RUUzXHU3NDA2XHU1MjMwXHU1NDBFXHU3QUVGQVBJXHJcbiAgICAgICAgcHJveHk6IHtcclxuICAgICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDAnLFxyXG4gICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICAgIHdzOiB0cnVlLCAvLyBcdTY1MkZcdTYzMDFXZWJTb2NrZXRcdTRFRTNcdTc0MDZcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyBcdTkxNERcdTdGNkVcdTY1ODdcdTRFRjZcdTc2RDFcdTU0MkMsXHU2MzkyXHU5NjY0XHU1NDBFXHU3QUVGXHU3NkVFXHU1RjU1XHU1NDhDXHU5NzVFXHU1MjREXHU3QUVGXHU2NTg3XHU0RUY2XHJcbiAgICAgICAgd2F0Y2g6IHtcclxuICAgICAgICAgIGlnbm9yZWQ6IFtcclxuICAgICAgICAgICAgJyoqL2JhY2tlbmQvKionLFxyXG4gICAgICAgICAgICAnKiovKi5weScsXHJcbiAgICAgICAgICAgICcqKi8qLnB5YycsXHJcbiAgICAgICAgICAgICcqKi8qLnNxbCcsXHJcbiAgICAgICAgICAgICcqKi8qLmxvZycsXHJcbiAgICAgICAgICAgICcqKi8ucW9kZXIvKionLFxyXG4gICAgICAgICAgICAnKiovLnB5dGVzdF9jYWNoZS8qKicsXHJcbiAgICAgICAgICAgICcqKi91cGxvYWRzLyoqJyxcclxuICAgICAgICAgICAgJyoqL3dvcmtzcGFjZS8qKicsXHJcbiAgICAgICAgICAgICcqKi9fX3B5Y2FjaGVfXy8qKicsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0c2NvbmZpZ1BhdGhzKCldLFxyXG4gICAgICBjc3M6IHtcclxuICAgICAgICBwb3N0Y3NzOiB7XHJcbiAgICAgICAgICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MsIGF1dG9wcmVmaXhlcl0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgZGVmaW5lOiB7XHJcbiAgICAgICAgJ3Byb2Nlc3MuZW52LkFQSV9LRVknOiBKU09OLnN0cmluZ2lmeShlbnYuT1BFTkFJX0FQSV9LRVkpLFxyXG4gICAgICAgICdwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSc6IEpTT04uc3RyaW5naWZ5KGVudi5PUEVOQUlfQVBJX0tFWSlcclxuICAgICAgfSxcclxuICAgICAgcmVzb2x2ZToge1xyXG4gICAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuJyksXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXFPLE9BQU8sVUFBVTtBQUN0UCxTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxrQkFBa0I7QUFMekIsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDdEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxLQUFLLEVBQUU7QUFDakMsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBO0FBQUE7QUFBQSxNQUVOLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxVQUNSLElBQUk7QUFBQTtBQUFBLFFBQ047QUFBQSxNQUNGO0FBQUE7QUFBQSxNQUVBLE9BQU87QUFBQSxRQUNMLFNBQVM7QUFBQSxVQUNQO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztBQUFBLElBQ2xDLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxRQUNQLFNBQVMsQ0FBQyxhQUFhLFlBQVk7QUFBQSxNQUNyQztBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLHVCQUF1QixLQUFLLFVBQVUsSUFBSSxjQUFjO0FBQUEsTUFDeEQsOEJBQThCLEtBQUssVUFBVSxJQUFJLGNBQWM7QUFBQSxJQUNqRTtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsR0FBRztBQUFBLE1BQ2xDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
