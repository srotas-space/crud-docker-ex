# Node TypeScript CRUD API --- 3 Phase Implementation

## Overview

This project demonstrates a progressive engineering workflow:

-   **Phase 1:** Run locally (No Docker)
-   **Phase 2:** Run with Docker Compose
-   **Phase 3:** Optimize image with Multi‑Stage Build

Stack: - Node.js (TypeScript) - PostgreSQL - Redis - Docker - Docker
Compose

------------------------------------------------------------------------

# Project Structure

    node-ts-crud/
    │
    ├── src/
    │   ├── config.ts
    │   └── index.ts
    │
    ├── package.json
    ├── tsconfig.json
    ├── Dockerfile
    ├── docker-compose.yaml
    ├── .env
    ├── .dockerignore

------------------------------------------------------------------------

# Base Application Code

## package.json

``` json
{
  "name": "node-ts-crud",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn src/index.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.7"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

------------------------------------------------------------------------

## tsconfig.json

``` json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

------------------------------------------------------------------------

## src/config.ts

``` ts
import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required ENV: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  pg: {
    host: required("PG_HOST"),
    user: required("PG_USER"),
    password: required("PG_PASSWORD"),
    database: required("PG_DATABASE"),
    port: Number(required("PG_PORT")),
  },
  redisUrl: required("REDIS_URL"),
};
```

------------------------------------------------------------------------

## src/index.ts

``` ts
import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";
import { config } from "./config";

const app = express();
app.use(express.json());

const pgPool = new Pool(config.pg);

const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.connect();

pgPool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
  )
`);

app.post("/users", async (req, res) => {
  const { name } = req.body;
  const result = await pgPool.query(
    "INSERT INTO users(name) VALUES($1) RETURNING *",
    [name]
  );
  await redisClient.del("users");
  res.json(result.rows[0]);
});

app.get("/users", async (_, res) => {
  const cached = await redisClient.get("users");
  if (cached) return res.json(JSON.parse(cached));

  const result = await pgPool.query("SELECT * FROM users");
  await redisClient.set("users", JSON.stringify(result.rows));
  res.json(result.rows);
});

app.delete("/users/:id", async (req, res) => {
  await pgPool.query("DELETE FROM users WHERE id=$1", [
    req.params.id,
  ]);
  await redisClient.del("users");
  res.json({ message: "Deleted" });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
```

------------------------------------------------------------------------

# Phase 1 --- Run Locally (No Docker)

## .env

    PORT=3000

    PG_HOST=localhost
    PG_USER=postgres
    PG_PASSWORD=postgres
    PG_DATABASE=testdb
    PG_PORT=5432

    REDIS_URL=redis://localhost:6379

## Run

    npm install
    npm run dev

------------------------------------------------------------------------

# Phase 2 --- Docker Compose

## Dockerfile (Single Stage)

``` dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

------------------------------------------------------------------------

## docker-compose.yaml

``` yaml
version: "3.9"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: testdb
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

## Docker .env

    PORT=3000

    PG_HOST=postgres
    PG_USER=postgres
    PG_PASSWORD=postgres
    PG_DATABASE=testdb
    PG_PORT=5432

    REDIS_URL=redis://redis:6379

## Run

    docker-compose up --build

------------------------------------------------------------------------

# Phase 3 --- Optimized Multi‑Stage Build

## Optimized Dockerfile

``` dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## Run

    docker-compose up --build

------------------------------------------------------------------------

# Phase Comparison

  Phase     Environment      Image Size   Complexity
  --------- ---------------- ------------ ---------------
  Phase 1   Local            None         Simple
  Phase 2   Docker Compose   \~1GB        Containerized
  Phase 3   Docker Compose   \~180MB      Optimized

------------------------------------------------------------------------

# Test Cases
------------------------------------------------------------------------
### Create User (POST)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
        "name": "John Doe",
        "email": "john@example.com"
      }'

### Get All Users (GET)
curl http://localhost:3000/users



### Delete User (DELETE)
curl -X DELETE http://localhost:3000/users/1
------------------------------------------------------------------------



# Check image size
------------------------------------------------------------------------
docker images

docker image ls


REPOSITORY        TAG       IMAGE ID       CREATED        SIZE
node-ts-crud      latest    a1b2c3d4e5f6   2 minutes ago  1.12GB
postgres          15        9f8e7d6c5b4a   3 days ago     374MB
redis             7         1a2b3c4d5e6f   2 weeks ago    117MB


docker image inspect crud-app:latest --format='{{.Size}}'


docker image inspect crud-app:latest \
  --format='{{.Size}}' | numfmt --to=iec


docker history node-ts-crud:latest

------------------------------------------------------------------------




# 🐳 Docker Hub Setup & Push Guide

------------------------------------------------------------------------

## 1️⃣ Create Docker Hub Account

1.  Go to: https://hub.docker.com/
2.  Click **Sign Up**
3.  Fill:
    -   Username (example: `xsmmaurya`)
    -   Email
    -   Password
4.  Verify email
5.  Login to Docker Hub

------------------------------------------------------------------------

## 2️⃣ Create Access Token (Recommended)

> 🔐 If 2FA is enabled, password login will NOT work. Use Access Token.

### Steps:

1.  Click your profile icon (top-right)
2.  Go to **Account Settings**
3.  Click **Security**
4.  Click **New Access Token**
5.  Provide:
    -   Token Description: `local-mac-push`
    -   Access: Read & Write
6.  Click **Generate**
7.  Copy the token immediately (you won't see it again)

------------------------------------------------------------------------

## 3️⃣ Login from Terminal Using Access Token

``` bash
docker login -u YOUR_DOCKER_USERNAME
```

Example:

``` bash
docker login -u xsmmaurya
```

When prompted for password → paste the **Access Token**

You should see:

    Login Succeeded

------------------------------------------------------------------------

## 4️⃣ Create Repository (Optional but Recommended)

1.  Go to Docker Hub
2.  Click **Create Repository**
3.  Name: `custody`
4.  Visibility:
    -   Public (free)
    -   Private (limited free plan)

Repo path format:

    dockerhub_username/repository

Example:

    xsmmaurya/custody

------------------------------------------------------------------------

## 5️⃣ Tag Your Local Image

Check local images:

``` bash
docker images
```

Tag properly:

``` bash
docker tag custody:1.0.0 xsmmaurya/custody:1.0.0
docker tag custody:1.0.0 xsmmaurya/custody:latest
```

Format reminder:

    dockerhub_username/repository:tag

------------------------------------------------------------------------

## 6️⃣ Push Image to Docker Hub

``` bash
docker push xsmmaurya/custody:1.0.0
docker push xsmmaurya/custody:latest
```

------------------------------------------------------------------------

## 7️⃣ Multi‑Arch Build & Push (buildx)

``` bash
docker buildx build   --platform linux/amd64,linux/arm64   -t xsmmaurya/custody:1.0.0   -t xsmmaurya/custody:latest   --push .
```

> `--push` uploads directly --- no separate push command needed.

------------------------------------------------------------------------

## 🔐 Security Best Practices

-   Never commit access tokens to Git
-   Use environment variables in CI/CD
-   Rotate tokens periodically


# End of Guide




