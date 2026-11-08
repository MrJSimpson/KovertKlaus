FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV STATIC_EXPORT=false

RUN npx prisma generate
RUN npm run build
# First-run seed as one JS file (resolves the @/ aliases), so the runner needs neither src/ nor tsx.
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=cjs --packages=external --log-level=warning --outfile=prisma/seed.bundle.cjs

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
# Schema sync + first-run seed before the server starts (scripts/docker-db-bootstrap.mjs).
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-db-bootstrap.mjs ./scripts/docker-db-bootstrap.mjs

# Account-deletion exports (EXPORT_DIR); a named volume mounted here inherits this ownership.
RUN mkdir -p /app/data/exports && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 2425

ENV PORT 2425
ENV HOSTNAME "0.0.0.0"

CMD ["sh", "-c", "node scripts/docker-db-bootstrap.mjs && exec node server.js"]
