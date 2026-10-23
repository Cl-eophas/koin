const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain an uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must contain a lowercase letter.");
  if (!/\d/.test(password)) errors.push("Password must contain a digit.");
  return { valid: errors.length === 0, errors };
};

module.exports = { validatePassword };
