// The career ladder, lowest to highest. A promotion always moves exactly one step.
// "staff" is the permanent level: it is stored as employment_type "contract" to match
// the existing data model.
const LEVELS = [
  { key: "casual", label: "Casual", role: "staff", employment_type: "casual", profile_type: "casual", needsBranch: true },
  { key: "reliever", label: "Reliever", role: "staff", employment_type: "reliever", profile_type: "reliever", needsBranch: true },
  { key: "staff", label: "Staff", role: "staff", employment_type: "contract", profile_type: "contract", needsBranch: true },
  { key: "supervisor", label: "Supervisor", role: "supervisor", employment_type: "supervisor", profile_type: null, needsBranch: true },
  // General supervisors oversee every branch, so they are never tied to one.
  { key: "general_supervisor", label: "General Supervisor", role: "general_supervisor", employment_type: "general_supervisor", profile_type: null, needsBranch: false },
  { key: "admin", label: "Admin", role: "admin", employment_type: null, profile_type: null, needsBranch: false },
];

const indexOfKey = (key) => LEVELS.findIndex((l) => l.key === key);

function currentLevelKey(user, profileType) {
  if (user.role === "admin") return "admin";
  if (user.role === "general_supervisor") return "general_supervisor";
  if (user.role === "supervisor") return "supervisor";
  const t = profileType || user.employment_type;
  if (t === "casual") return "casual";
  if (t === "reliever") return "reliever";
  return "staff";
}

function nextLevel(key) {
  const i = indexOfKey(key);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

module.exports = { LEVELS, currentLevelKey, nextLevel, indexOfKey };
