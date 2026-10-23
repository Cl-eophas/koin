/**
 * Nightly rollup hook — extend to persist precomputed summaries (e.g. Mongo collection)
 * when org size requires avoiding heavy aggregates on dashboard load.
 */
const cron = require("node-cron");

if (process.env.ENABLE_ROLLUP_CRON === "true") {
  cron.schedule("15 1 * * *", () => {
    console.log("[rollupAttendanceCache] nightly rollup placeholder — wire DB cache if needed.");
  });
}
