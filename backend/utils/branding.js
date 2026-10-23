const SystemSetting = require("../models/SystemSetting");

// The name shown in the interface. The legal company name on contracts is separate and does not change.
const DEFAULT_BRANDING = { system_name: "koin", short_name: "K" };

async function getBranding() {
  const doc = await SystemSetting.findOne({ key: "branding" }).lean();
  return { ...DEFAULT_BRANDING, ...(doc?.value || {}) };
}

module.exports = { DEFAULT_BRANDING, getBranding };
