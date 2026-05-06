// worker.js
require("dotenv").config();
const redis = require("redis");

const express = require('express');
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const METRICS_PORT = process.env.METRICS_PORT || 5000;
app.listen(METRICS_PORT, () => {
  console.log(`Worker metrics server listening on port ${METRICS_PORT}`);
});

async function startWorker() {
  const redisConfig = {
    url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
  };

  // We need two clients because brPop blocks the connection.
  // One client will handle the worker loop, and another will handle heartbeats.
  const heartbeatClient = redis.createClient(redisConfig);
  const workerClient = redis.createClient(redisConfig);

  heartbeatClient.on("error", (err) => console.error("Heartbeat Redis Error", err.message));
  workerClient.on("error", (err) => console.error("Worker Redis Error", err.message));

  try {
    await Promise.all([heartbeatClient.connect(), workerClient.connect()]);
    console.log("Worker connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis:", err.message);
    process.exit(1);
  }

  // immediate heartbeat to indicate worker is alive on startup
  await heartbeatClient.setEx("worker_alive", 10, "1");

  setInterval(async () => {
    try {
      await heartbeatClient.setEx("worker_alive", 10, "1");
    } catch (err) {
      console.error("Heartbeat failed:", err.message);
    }
  }, 2000);

  while (true) {
    try {
      // brPop blocks the connection until a job is available
      const job = await workerClient.brPop("jobs", 0);
      if (job) {
        console.log("Processing job:", job);
        // Add job processing logic here
      }
    } catch (err) {
      console.error("Worker error:", err.message);
      // Wait a bit before retrying on error
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

startWorker().catch(err => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});