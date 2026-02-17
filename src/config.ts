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
