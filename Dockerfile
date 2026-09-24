FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace apps/api && npm cache clean --force
COPY apps/api/src apps/api/src
COPY apps/web/public/pet_breeds_COMPLETE_1.xlsx apps/web/public/pet_breeds_COMPLETE_1.xlsx
ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "apps/api/src/index.js"]
