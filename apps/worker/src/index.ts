import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";

const logger = pino({
  name: "gzaccess-worker",
  level: process.env.LOG_LEVEL ?? "info",
});
const connection = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export const syncQueue = new Queue("gzaccess-sync", { connection });

logger.info({ queue: syncQueue.name }, "Worker base initialized");

if (process.env.NODE_ENV !== "test") {
  process.on("SIGINT", async () => {
    await syncQueue.close();
    connection.disconnect();
    process.exit(0);
  });
}
