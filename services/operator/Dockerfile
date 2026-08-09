# Persistent RevenueOS operator container.
#
# The service is TypeScript-source executed via `tsx`. There is no build
# step: the runtime interprets the .ts files directly. This keeps the
# image slim and avoids a separate compile pipeline.
#
# Build from the repo root:
#   docker build -f services/operator/Dockerfile -t revenueos-operator .

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# The operator depends on the @revenueos/core workspace package via a
# `file:` reference. Copy it in first so `npm install` can resolve it.
COPY packages/revenueos ./packages/revenueos
COPY services/operator ./services/operator

WORKDIR /app/services/operator
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 8080
ENV PORT=8080
CMD ["npx", "tsx", "src/index.ts"]
