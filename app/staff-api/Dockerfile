# ==============================================================================
# 職員向けAPI Dockerfile
# ==============================================================================
# Node.js 18 Alpine（軽量版）
FROM node:18-alpine AS builder

WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# TypeScript ビルド
RUN npm run build

# ==============================================================================
# Production Image
# ==============================================================================
FROM node:18-alpine

WORKDIR /app

# 必要なファイルのみコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# ポート公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# アプリケーション起動
CMD ["node", "dist/index.js"]
