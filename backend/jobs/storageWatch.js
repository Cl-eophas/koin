const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");
const SystemSetting = require("../models/SystemSetting");
const { storageInfo } = require("../utils/storage");

// Storage levels. At 50% the admins are told to clean up. At 85% everyone is told to download their records.
const LEVELS = [
  { level: 1, at: 50 },
  { level: 2, at: 85 },
];

// Checks every six hours. Each level is sent at most once a day, and only when it is reached.
cron.schedule("0 */6 * * *", async () => {
  try {
    const info = await storageInfo();
    if (info.percent === null) return;
    const current = [...LEVELS].reverse().find((l) => info.percent >= l.at);
    if (!current) return;

    const today = new Date().toISOString().slice(0, 10);
    const last = await SystemSetting.findOne({ key: "storage_notice" }).lean();
    const sentToday = last && last.value && last.value.date === today ? last.value.level : 0;
    if (sentToday >= current.level) return;

    const audience = current.level === 2
      ? await User.find({ is_active: true, deleted_at: null, role: { $ne: null } }).select("_id role").lean()
      : await User.find({ is_active: true, deleted_at: null, role: "admin" }).select("_id role").lean();

    const message = (role) => {
      if (current.level === 2) {
        return role === "admin"
          ? `Database storage is ${info.percent}% full. Export old records in Data & Storage, then delete them to free space.`
          : `Database storage is ${info.percent}% full. Download your records from your profile (My records) so nothing is lost.`;
      }
      return `Database storage is ${info.percent}% full (half of the free space). Open Data & Storage to export and clear old records.`;
    };

    await Notification.insertMany(audience.map((u) => ({ user_id: u._id, type: "info", message: message(u.role) })));
    await SystemSetting.findOneAndUpdate(
      { key: "storage_notice" },
      { value: { date: today, level: current.level, percent: info.percent } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[storageWatch]", err.message);
  }
});

console.log("✅ Storage watch running (every 6 hours; admins at 50%, everyone at 85%)");
