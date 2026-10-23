const test = require("node:test");
const assert = require("node:assert");
process.env.JWT_SECRET = "test";
const { canMessage } = require("../controllers/messagesController");

const branchA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const branchB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const u = (role, branch, extra = {}) => ({ _id: `${role}-${branch || "none"}-${Math.random()}`, role, branch_id: branch, is_active: true, deleted_at: null, ...extra });

test("admin and general supervisors reach everyone", () => {
  const admin = u("admin", null);
  const gs = u("general_supervisor", null);
  assert.ok(canMessage(admin, u("staff", branchB)));
  assert.ok(canMessage(gs, u("supervisor", branchA)));
});

test("a staff member reaches their own branch's supervisor only", () => {
  const staff = u("staff", branchA);
  assert.ok(canMessage(staff, u("supervisor", branchA)));
  assert.strictEqual(canMessage(staff, u("supervisor", branchB)), false);
  assert.strictEqual(canMessage(staff, u("staff", branchA)), false);
});

test("a supervisor reaches staff and supervisors in their branch", () => {
  const sup = u("supervisor", branchA);
  assert.ok(canMessage(sup, u("staff", branchA)));
  assert.ok(canMessage(sup, u("supervisor", branchA)));
  assert.strictEqual(canMessage(sup, u("staff", branchB)), false);
});

test("everyone reaches admins and general supervisors", () => {
  assert.ok(canMessage(u("staff", branchA), u("admin", null)));
  assert.ok(canMessage(u("supervisor", branchB), u("general_supervisor", null)));
});

test("nobody messages themselves or a deactivated account", () => {
  const sup = u("supervisor", branchA);
  assert.strictEqual(canMessage(sup, sup), false);
  assert.strictEqual(canMessage(sup, u("staff", branchA, { is_active: false })), false);
  assert.strictEqual(canMessage(sup, u("staff", branchA, { deleted_at: new Date() })), false);
});
