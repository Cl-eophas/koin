const { test } = require("node:test");
const assert = require("node:assert");
const { haversineDistance } = require("../utils/geo");

test("haversine: ~0m for identical points", () => {
  assert.ok(haversineDistance(-1.2921, 36.8219, -1.2921, 36.8219) < 1);
});

test("haversine: Nairobi-ish span is in expected ballpark", () => {
  const m = haversineDistance(-1.29, 36.82, -1.3, 36.83);
  assert.ok(m > 1000 && m < 20000);
});
