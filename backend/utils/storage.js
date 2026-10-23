const mongoose = require("mongoose");

// The free database tier allows 512 MB. Override with DB_STORAGE_LIMIT_MB if the plan changes.
const LIMIT_BYTES = Number(process.env.DB_STORAGE_LIMIT_MB || 512) * 1024 * 1024;

async function storageInfo() {
  try {
    const s = await mongoose.connection.db.stats();
    const used = Number(s.storageSize || s.dataSize || 0);
    return { used_bytes: used, limit_bytes: LIMIT_BYTES, percent: Math.round((used / LIMIT_BYTES) * 100) };
  } catch (e) {
    return { used_bytes: null, limit_bytes: LIMIT_BYTES, percent: null, error: "The database did not report its size." };
  }
}

module.exports = { storageInfo, LIMIT_BYTES };
