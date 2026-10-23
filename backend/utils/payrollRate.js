/**
 * Normalizes admin request bodies that may send `pay_rate` (canonical) or `rate` (legacy).
 * Caps depend on rate_type: hourly vs daily.
 */
const parsePayRateBody = (body) => {
  const raw = body.pay_rate != null ? body.pay_rate : body.rate;
  if (raw == null || raw === "") return { error: "Rate must be a positive number." };
  const rate = parseFloat(raw);
  if (isNaN(rate) || rate <= 0) return { error: "Rate must be a positive number." };
  const rate_type = body.rate_type === "hourly" ? "hourly" : "daily";
  const max = rate_type === "hourly" ? 5000 : 50000;
  if (rate > max) {
    return {
      error:
        rate_type === "hourly"
          ? "Hourly rate exceeds maximum allowed (KES 5,000/hr). Flag for review."
          : "Daily rate exceeds maximum allowed (KES 50,000/day). Flag for review.",
    };
  }
  return { rate, rate_type };
};

module.exports = { parsePayRateBody };
