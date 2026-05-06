// index.js
require("dotenv").config();

const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const redis = require("redis");
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));
async function redisConnect() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");

    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to Redis:", err.message);
    process.exit(1);
  }
}
redisConnect();

const express = require("express");

const app = express();

app.use(express.json());

app.get("/users", async (req, res) => {
  try {
    const result = await withTimeout(pool.query("SELECT NOW()"), 5000);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    if (err.message === "Timeout") {
      res.status(504).send("DB query timed out");
    } else {
      res.status(500).send("DB error");
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/queue", async (req, res) => {
  try {
    const length = await withTimeout(redisClient.lLen("jobs"), 2000);
    res.json({ queueLength: length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Queue unavailable" });
  }
});

app.get("/health/worker", async (req, res) => {
  try {
    const alive = await redisClient.get("worker_alive");

    if (!alive) {
      return res.status(503).json({ status: "Worker not alive" });
    }

    res.json({ status: "Worker alive" });

  } catch (err) {
    res.status(500).json({ error: "Redis unavailable" });
  }
});


app.post("/job", async (req, res) => {
  try {
    await withTimeout(
      redisClient.rPush("jobs", JSON.stringify({ task: "demo" })),
      2000 // 2 seconds
    );

    res.json({ message: "Job added to queue" });

  } catch (err) {
    console.error("Redis error:", err.message);
    res.status(500).json({ error: "Queue unavailable" });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const PORT = process.env.PORT || 5000;