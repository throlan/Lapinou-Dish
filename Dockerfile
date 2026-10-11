FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-package-lock

COPY data ./data
COPY db ./db
COPY docs ./docs
COPY scripts ./scripts
COPY src ./src
COPY web ./web
COPY docker ./docker
RUN node scripts/seed-ciqual.mjs --output db/seeds/ciqual-2025.sql \
    && test -s db/seeds/ciqual-2025.sql \
    && chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
