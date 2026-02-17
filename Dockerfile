FROM node:20-alpine AS daemon

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build






# --- PHASE 2 --- #

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=daemon /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

CMD ["node", "dist/index.js"]