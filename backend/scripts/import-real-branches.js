// Imports the real Carrefour branches and deactivates the dummy ones.
//   node scripts/import-real-branches.js --dry-run   (shows what would change)
//   node scripts/import-real-branches.js             (applies the change)
// Run from the backend folder. Needs MONGODB_URI in the project's .env file and internet access.
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Branch = require("../models/Branch");
const User = require("../models/User");

const DRY = process.argv.includes("--dry-run");
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "real-branches.json"), "utf8"));
// Existing branches the import must leave completely alone (not changed, not deactivated, people not moved).
const LEAVE_ALONE = ["Nairobi CBD Branch"];
const RADIUS_M = 200; // a shop's clock-in area; adjust per branch on the Branches page
const TOWN_CENTRES = {
  Nairobi: [-1.2921, 36.8219], Ruiru: [-1.1496, 36.9605], Ruai: [-1.3486, 36.9590],
  "Ongata Rongai, Kajiado": [-1.3937, 36.7606], Mombasa: [-4.0435, 39.6682], "Diani, Kwale": [-4.3167, 39.5833],
  "Watamu, Kilifi": [-3.3581, 40.0229], Kisumu: [-0.0917, 34.7680], "Kenol, Murang'a": [-0.9147, 37.1600],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lookupError = null;
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "YPPEOPLE-HR-branch-import/1.0" } });
    if (!res.ok) { lookupError = `lookup service answered HTTP ${res.status}`; return null; }
    const json = await res.json();
    if (json[0]) return { lat: Number(json[0].lat), lng: Number(json[0].lon) };
    lookupError = "no match for this address";
  } catch (e) {
    lookupError = `could not reach the lookup service (${e.cause?.code || e.message})`;
  }
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const realNames = new Set(REAL.map((b) => b.name));
  const report = { created: [], updated: [], deactivated: [], needs_check: [], located: [], blocked: [] };

  for (const b of REAL) {
    const found = await Branch.findOne({ name: b.name });
    let pos = null;
    let source = "manual";
    if (typeof b.lat === "number" && typeof b.lng === "number") {
      pos = { lat: b.lat, lng: b.lng }; // exact coordinates given in the data file
    } else {
      lookupError = null;
      // Try the street address first, then the name with the town. Business names often don't match.
      pos = null;
      for (const q of [`${b.address}, Kenya`, `${b.name}, ${b.town}, Kenya`]) {
        if (!pos) pos = await geocode(q);
        await sleep(1100); // the lookup service asks for at most one request a second
      }
      source = "geocoded";
      if (pos) report.located.push(b.name);
      if (!pos) {
        pos = { lat: TOWN_CENTRES[b.town][0], lng: TOWN_CENTRES[b.town][1] };
        source = "approximate";
        report.needs_check.push(`${b.name}: ${lookupError}. Town centre used; enter lat/lng in real-branches.json`);
      }
    }
    const fields = {
      name: b.name,
      address: b.address,
      opening_hours: b.hours,
      latitude: pos.lat,
      longitude: pos.lng,
      branchLocation: { lat: pos.lat, lng: pos.lng, address: b.address },
      location_source: source,
      radius_meters: found?.radius_meters || RADIUS_M,
      clockInRadius: found?.radius_meters || RADIUS_M,
      is_active: true,
    };
    if (found) {
      report.updated.push(b.name);
      if (!DRY) await Branch.updateOne({ _id: found._id }, { $set: fields });
    } else {
      report.created.push(b.name);
      if (!DRY) await Branch.create(fields);
    }
  }

  // Dummy branches are deactivated, never deleted, so attendance history stays intact.
  const dummies = await Branch.find({ name: { $nin: [...realNames, ...LEAVE_ALONE] } });
  for (const d of dummies) {
    const people = await User.countDocuments({ branch_id: d._id, deleted_at: null, is_active: true });
    if (people > 0) {
      report.blocked.push(`${d.name}: ${people} active person(s) still assigned. Move them, then run this again.`);
      continue;
    }
    report.deactivated.push(d.name);
    if (!DRY) await Branch.updateOne({ _id: d._id }, { $set: { is_active: false } });
  }

  console.log(DRY ? "DRY RUN, nothing was changed\n" : "Done\n");
  console.log("Created:", report.created.length, report.created.join(", ") || "-");
  console.log("Updated:", report.updated.length);
  console.log("Dummy branches deactivated:", report.deactivated.join(", ") || "-");
  console.log("Positions found automatically (check these on the map):", report.located.length ? "\n  - " + report.located.join("\n  - ") : "none");
  console.log("Need a position check on the map:", report.needs_check.length ? "\n  - " + report.needs_check.join("\n  - ") : "none");
  console.log("Blocked:", report.blocked.length ? "\n  - " + report.blocked.join("\n  - ") : "none");
  await mongoose.disconnect();
})().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });
