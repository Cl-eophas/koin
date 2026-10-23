/** Strip HTML tags from user-supplied text (defense in depth for stored XSS). */
const stripHtml = (input) => {
  if (input == null) return "";
  return String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
};

module.exports = { stripHtml };
