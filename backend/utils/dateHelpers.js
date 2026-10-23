const getTodayString = () => new Date().toISOString().slice(0, 10);

const calcAnnualLeaveAccrual = (joinDate) => {
  const now = new Date();
  const j = new Date(joinDate);
  const months = (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
  return Math.max(0, months * 1.75);
};

const isSickLeaveEligible = (joinDate) => {
  const j = new Date(joinDate);
  const now = new Date();
  const months = (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
  return months >= 2;
};

module.exports = { getTodayString, calcAnnualLeaveAccrual, isSickLeaveEligible };
