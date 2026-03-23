require("dotenv").config();

const {
  PRINT_SCHEDULER_ENABLED,
  PRINT_SCHEDULER_INTERVAL_MS,
} = require("./lib/env");
const {
  startPrintScheduler,
  stopPrintScheduler,
  runPrintSchedulerTick,
} = require("./services/print.service");

let shuttingDown = false;

async function startWorker() {
  if (!PRINT_SCHEDULER_ENABLED) {
    console.log("Print scheduler worker disabled (PRINT_SCHEDULER_ENABLED=false).");
    return;
  }

  await runPrintSchedulerTick();
  startPrintScheduler({ keepAlive: true });
  console.log(`Print scheduler worker started (interval=${PRINT_SCHEDULER_INTERVAL_MS}ms).`);
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] Received ${signal}, stopping print scheduler worker...`);
  stopPrintScheduler();
  process.exit(0);
}

if (require.main === module) {
  startWorker().catch((error) => {
    console.error("[worker] Failed to start print scheduler worker:", error);
    process.exit(1);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = {
  startWorker,
  shutdown,
};
