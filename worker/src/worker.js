// worker.js
const redis = require("redis");

async function startWorker() {
  const client = redis.createClient({
    url: "redis://localhost:6379"
  });

  await client.connect();

  console.log("Worker connected to Redis");

  while (true) {
    const message = await client.lPop("jobs");
    if (message) {
      console.log("Processing job:", message);
    }
  }
}

startWorker();