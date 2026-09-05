import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// 后端地址可通过环境变量覆盖（E2E 测试会指向独立测试后端端口）
const apiTarget = process.env.DEBATE_API_TARGET || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
