const { test, describe } = require("node:test");
const assert = require("node:assert");
const { resolveBranchDocument } = require("../utils/branchResolve");

describe("resolveBranchDocument", () => {
  test("prefers populated branch_id with geo over unpopulated branch", () => {
    const pop = {
      _id: "507f1f77bcf86cd799439011",
      branchLocation: { lat: -1.29, lng: 36.82 },
      name: "Westlands",
    };
    const u = { branch_id: pop, branch: "507f1f77bcf86cd799439012" };
    assert.strictEqual(resolveBranchDocument(u), pop);
  });

  test("uses populated branch when branch_id missing geo but branch has legacy lat/lng", () => {
    const b = { _id: "507f1f77bcf86cd799439011", latitude: -1.0, longitude: 37.0 };
    const u = { branch: b };
    assert.strictEqual(resolveBranchDocument(u), b);
  });
});
