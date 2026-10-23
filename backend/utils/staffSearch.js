const mongoose = require("mongoose");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns user ObjectIds matching name, email, or YP staff_id (StaffProfile.staff_id).
 * Empty array = no matches. null = no search term (caller should not filter).
 */
async function matchUserIdsByStaffSearch(search) {
  if (search == null || !String(search).trim()) return null;
  const term = escapeRegExp(String(search).trim());
  const [nameUsers, emailUsers, phoneUsers, idUsers, profUsers] = await Promise.all([
    User.find({ name: { $regex: term, $options: "i" } }).select("_id").lean(),
    User.find({ email: { $regex: term, $options: "i" } }).select("_id").lean(),
    User.find({ phone: { $regex: term, $options: "i" } }).select("_id").lean(),
    User.find({ idNumber: { $regex: term, $options: "i" } }).select("_id").lean(),
    StaffProfile.find({ staff_id: { $regex: term, $options: "i" } }).select("user_id").lean(),
  ]);
  const set = new Set();
  for (const u of nameUsers) set.add(u._id.toString());
  for (const u of emailUsers) set.add(u._id.toString());
  for (const u of phoneUsers) set.add(u._id.toString());
  for (const u of idUsers) set.add(u._id.toString());
  for (const p of profUsers) set.add(p.user_id.toString());
  return [...set].map((id) => new mongoose.Types.ObjectId(id));
}

module.exports = { escapeRegExp, matchUserIdsByStaffSearch };
