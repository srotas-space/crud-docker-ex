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
