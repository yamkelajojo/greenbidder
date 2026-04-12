/**
 * Formats a number as South African Rand.
 * @param {number} amount
 * @returns {string} e.g. "R 25,00"
 */
export const formatZAR = (amount) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
};
