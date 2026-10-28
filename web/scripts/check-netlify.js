// Runs before every build (npm runs "prebuild" automatically).
// Stops the build if netlify.toml still has a placeholder or no /api redirect,
// so a broken config cannot be deployed to the live site.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "netlify.toml");
const text = fs.readFileSync(file, "utf8");
const problems = [];

if (/YOUR-BACKEND/i.test(text)) problems.push("netlify.toml still contains the placeholder YOUR-BACKEND.");
if (!/from\s*=\s*"\/api\/\*"/.test(text)) problems.push('netlify.toml has no redirect from "/api/*".');
if (!/to\s*=\s*"https:\/\/[^"]+\/api\/:splat"/.test(text)) problems.push("The /api redirect must point to https://<backend>/api/:splat.");
if (/localhost/i.test(text)) problems.push("netlify.toml points at localhost; use the live backend address.");

if (problems.length) {
  console.error("\nBUILD STOPPED: netlify.toml needs fixing.");
  problems.forEach((p) => console.error("  - " + p));
  process.exit(1);
}
console.log("netlify.toml check passed.");
