// Creates the first admin on an empty database. Run it once, right after the first deploy.
//   ADMIN_NAME="Full Name" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="StrongPass1" node scripts/create-first-admin.js
// It refuses to run if an admin already exists.
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const { validatePassword } = require("../utils/passwordPolicy");

(async () => {
  const name = (process.env.ADMIN_NAME || "").trim();
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (name.length < 2 || !email.includes("@")) throw new Error("Set ADMIN_NAME and a valid ADMIN_EMAIL.");
  const check = validatePassword(password);
  if (!check.valid) throw new Error("ADMIN_PASSWORD must be 8+ characters with an uppercase letter, a lowercase letter and a digit.");

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  if (await User.exists({ role: "admin", deleted_at: null })) {
    throw new Error("An admin already exists. Sign in as that admin instead.");
  }
  await new User({
    name,
    email,
    password,
    role: "admin",
    status: "approved",
    is_active: true,
    isVerified: true,
    profileCompleted: true,
    force_password_reset: true,
  }).save();
  console.log(`First admin created: ${email}. Sign in and change the password.`);
  await mongoose.disconnect();
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
