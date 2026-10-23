// Removes any branch still set on an admin account. Safe to run more than once.
//   node scripts/clear-admin-branches.js --dry-run
//   node scripts/clear-admin-branches.js
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const DRY = process.argv.includes("--dry-run");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const admins = await User.find({ role: "admin", $or: [{ branch_id: { $ne: null } }, { branch: { $ne: null } }] }).select("name branch_id").lean();
  console.log(`Admins with a branch: ${admins.length}`);
  admins.forEach((a) => console.log(`  - ${a.name}`));
  if (!DRY && admins.length) {
    // updateMany skips the model hook, so the fields are cleared explicitly.
    const r = await User.updateMany({ role: "admin" }, { $set: { branch_id: null, branch: null } });
    console.log(`Cleared: ${r.modifiedCount}`);
  } else if (DRY) {
    console.log("DRY RUN, nothing was changed");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
