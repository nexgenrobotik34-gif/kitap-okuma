FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx prisma generate && bun run build
ENV NODE_ENV=production HOSTNAME=0.0.0.0
RUN mkdir -p /app/db
CMD ["sh", "-c", "bunx prisma db push --skip-generate && bun .next/standalone/server.js"]
