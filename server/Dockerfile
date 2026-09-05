# ---- 构建阶段 ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# 安装原生模块(sqlite3)可能的编译依赖（有预编译包时不会触发）
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 移除开发依赖，缩小运行镜像
RUN npm prune --omit=dev

# ---- 运行阶段 ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# SQLite 数据目录（挂载卷）
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "dist/index.js"]
