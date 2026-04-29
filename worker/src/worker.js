// worker.js
const redis = require("redis");

async function startWorker() {
  const client = redis.createClient({
    url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
  });

  client.on("error", (err) => {
    console.error("Redis Client Error", err.message);
  });

  await client.connect();

  console.log("Worker connected to Redis");

  while (true) {
    try {
      setInterval(async () => {
        try {
          await client.set("worker_alive", Date.now().toString());
        } catch (err) {
          console.error("Heartbeat failed:", err.message);
        }
      }, 2000);

      while (true) {
        const job = await client.brPop("jobs", 0);
        if (job) {
          console.log("Processing job:", job);
        } else { 
          await new Promise(res => setTimeout(res, 1000));
        }
      }
      
    } catch (err) {
      console.error("Worker error:", err.message);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

startWorker();