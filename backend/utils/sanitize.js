const sanitizeInput = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeInput(item));
  if (typeof obj === "object" && obj.constructor === Object) {
    const out = {};
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      out[key] = sanitizeInput(obj[key]);
    }
    return out;
  }
  return obj;
};

module.exports = { sanitizeInput };
