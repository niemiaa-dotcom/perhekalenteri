# ---- Build stage: kompiloi React-frontti (vite build -> dist/) ----
# Node 24 = LTS, tukee TypeScriptin oletuksena (node server.ts toimii ilman flagia)
FROM node:24 AS build
WORKDIR /app

# Asenna kaikki riippuvuudet (myös dev-riippuvuudet, joita build tarvitsee)
COPY package*.json ./
RUN npm ci

# Kopioi lähdekoodi ja buildaa frontti
COPY . .
RUN npm run build

# ---- Runtime stage: vain tuotantoriippuvuudet + buildattu dist ----
FROM node:24
ENV NODE_ENV=production
WORKDIR /app

# Vain tuotantoriippuvuudet (better-sqlite3 on devDependency, ei asennu tuotantoon)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Serveri importtaa ajossa vain server.ts:n + palvelee dist/-kansion
COPY --from=build /app/dist ./dist
COPY server.ts ./

EXPOSE 3000
# = package.json:n "start"-skripti (node server.ts)
CMD ["node", "server.ts"]
