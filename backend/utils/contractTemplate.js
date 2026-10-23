// Builds the YP People employment agreement for one employee. The wording follows the company's
// signed agreement; only the personal and role details change from one person to the next.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + " Hundred"); n %= 100; if (n) parts.push("and"); }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "")); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

function numberToWords(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return "Zero";
  const parts = [];
  if (n >= 1000000) { parts.push(below1000(Math.floor(n / 1000000)) + " Million"); n %= 1000000; }
  if (n >= 1000) { parts.push(below1000(Math.floor(n / 1000)) + " Thousand"); n %= 1000; }
  if (n > 0) parts.push(below1000(n));
  return parts.join(", ").replace(", and", " and");
}

function ordinal(d) {
  const s = ["th", "st", "nd", "rd"];
  const v = d % 100;
  return d + (s[(v - 20) % 10] || s[v] || s[0]);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function buildEmploymentAgreement({ employeeName, idNumber, position, salary, startDate, termMonths, placeOfWork, signedDate }) {
  const start = new Date(startDate);
  const sd = `${ordinal(start.getDate())} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  const now = signedDate ? new Date(signedDate) : new Date();
  const amount = Math.round(Number(salary) || 0);
  const term = Number(termMonths) || 3;
  return [
    "EMPLOYMENT AGREEMENT",
    "",
    `THIS AGREEMENT is made this ${ordinal(now.getDate())} day of ${MONTHS[now.getMonth()]} ${now.getFullYear()} between;`,
    "",
    `YP PEOPLE LIMITED a Limited Liability Company incorporated as such under the Companies Act, laws of Kenya, and having its principal place of business at Nairobi and of Post Office Box Number 38424-00100 Nairobi, Kenya (hereinafter referred to as the "Employer"), and;`,
    "",
    `${employeeName || "________________"} of Identification Card No. ${idNumber || "________________"} (hereinafter referred to as the "Employee").`,
    "",
    "WHEREAS:",
    "a) The Employer is a Human Resource Management Company, located in Nairobi.",
    "b) The Employer desires to obtain the benefit of the services of the Employee, and the Employee desires to render such services on the terms and conditions set forth.",
    "",
    'IN CONSIDERATION of the promises and other goods and valuable consideration (the sufficiency and receipt of which are hereby acknowledged) the parties agree as follows:',
    "",
    "1. EMPLOYMENT",
    "The Employee agrees that he will at all times faithfully, industriously, and to the best of his skill, ability, experience and talents, perform all of the duties required of his position. In carrying out these duties and responsibilities, the Employee shall comply with all Employer policies, procedures, rules and regulations, both written and oral, as are announced by the Employer from time to time. It is also understood and agreed to by the Employee that his assignment, duties and responsibilities and reporting arrangements may be changed by the Employer in its sole discretion without causing termination of this agreement.",
    "",
    "2. POSITION TITLE",
    `a) The Employee will be positioned as ${position || "________________"}.`,
    "b) The Employee is required to perform the duties and undertake any other duties as may arise from time to time and as may be assigned to the employee in a professional manner.",
    "",
    "3. PLACE OF WORK",
    `a) The Employee will carry the duties as provided in Clause 2 at ${placeOfWork || "a designated work place/store or any other place which the Employer may designate"}.`,
    "b) The Employer may at any time transfer the employee without notice.",
    "",
    "4. DURATION AND COMMENCEMENT DATE",
    `a) This employment contract will commence on ${sd}.`,
    `b) This contract will be for a term of ${numberToWords(term)} (${term}) Months, subject to renewal unless otherwise terminated by either of the party.`,
    "",
    "5. SALARY, ALLOWANCES & BENEFITS",
    `(a) As full compensation the employee shall be paid on monthly basis at the rate of Kenya Shillings ${numberToWords(amount)} (Kshs. ${amount.toLocaleString("en-US")}/-) only per month. This amount is inclusive of house allowance.`,
    "(b) The employee will be paid on or before the 1st Week of every month.",
    "(c) Such payments shall be subject to such normal statutory deductions by the Employer, which include but not limited to KRA Income Tax, SHA & NSSF.",
    "(d) All reasonable expenses arising out of employment shall be reimbursed assuming same have been authorized prior to being incurred and with the provision of appropriate receipts.",
    "",
    "6. LEAVE",
    "The Employee shall be entitled to:",
    "i) Annual Leave — Twenty-One (21) days per year, accruing at a rate of 1.75 days per month.",
    "ii) Sick Leave — Granted in accordance with the Employment Act, 2007, and the Company's Terms and Conditions of Service. The Employee shall be entitled to seven (7) days' sick leave on full pay and a further seven (7) days on half pay in each period of twelve (12) months of continuous service, subject to production of a certificate of incapacity signed by a duly qualified medical practitioner.",
    "",
    "7. BENEFITS",
    "a) The Employer will provide a WIBA cover against injuries or fatalities arising from execution of the duties by the employee within the working hours.",
    "",
    "8. PROBATION PERIOD",
    "It is understood and agreed that the first ninety (90) days of employment shall constitute a probationary period during which period the Employer may, in its absolute discretion, terminate the Employee's employment, for any reason without notice or cause.",
    "",
    "9. PERFORMANCE REVIEWS",
    "The Employee will be provided with a written performance appraisal at least once per six months and said appraisal will be reviewed at which time all aspects of the assessment can be fully discussed.",
    "",
    "10. ABSENCE FROM DUTY",
    "If the employee absents himself/herself from duty without authority or notice, he/she shall be subject to any procedure, forfeit his salary for the number of days he is absent from duty, and in addition, he may be dismissed in accordance with the Employer's Terms and Conditions of Service.",
    "",
    "11. TERMINATION",
    "a) The employee may at any time terminate the service by giving the employer seven (7) days' notice in writing or by paying the employer seven (7) days' salary in lieu of notice.",
    "If the employee at any time:",
    "i) Neglects, refuses or otherwise becomes unable by any cause other than ill health to perform any of his duties or comply with any instructions related to his duties;",
    "ii) Improperly discloses any information respecting the affairs of the employer to any unauthorized person; or",
    "iii) Fails to comply with the provision of this Agreement or is guilty of gross misconduct bringing the employer into disrepute or incompatible with his continued employment subject to any procedure for inquiry into and establishing misconduct on his part, the person will be dismissed without notice.",
    "iv) Where the person engaged is dismissed under the provisions of this paragraph, all rights and advantages reserved to him by the Agreement shall cease and the Agreement shall terminate on the date of such dismissal.",
    "b) The Employer may terminate this Agreement and the Employee's employment at any time, without notice or payment in lieu of notice, for sufficient cause.",
    "c) The Employer may terminate the employment of the Employee at any time without the requirement to show sufficient cause pursuant to (b) above, provided the Employer pays to the Employee an amount as required by the Employment Act or other such legislation as may be in effect at the time of termination. This payment shall constitute the employee's entire entitlement and benefits arising from said termination.",
    "d) The employee agrees to return any property of the employer at the time of termination.",
    "e) Once an employee has been dismissed, he/she will not be transferred to another store in Kenya and or any other branch in East Africa.",
    "",
    "12. TERMINATION ON GROUNDS OF ILL-HEALTH",
    "If at any time it is certified by a medical practitioner approved by the Employer that the employee is by reason of ill health, incapable of performing the duties subject to any law relating to termination of contract of service, the person engaged may be required to relinquish his appointment from such date as may be notified to him by Employer and as from that date his term of engagement shall be deemed to have been completed.",
    "",
    "13. DEDUCTION FROM SALARY",
    "a) Where the person engaged is required to pay or reimburse amount owed to him due to negligence or has caused the Employer to lose, such amount may be recovered from the salary or any other sums due to the employee.",
    "b) Confirmed theft or fraud cases will be deducted from the employee's monthly salary.",
    "",
    "14. UNIFORM",
    "Upon signing of this Contract, the Employer shall issue the Employee with uniform, the cost of which shall be deducted from the Employee's first month's salary. Upon termination of this Contract, the Employee shall return the uniform issued to them in good condition, and the amount previously deducted shall be refunded to the Employee.",
    "",
    "15. GENERAL",
    "The employee is non-pensionable. However, the employee shall be entitled to all other rights, benefits and obligations under the Employer's terms & conditions as well as the Employment Act (unless expressly stated not to be applicable) as are in force for the employees of the Employer.",
    "",
    "16. NON-COMPETITION",
    "(1) It is further acknowledged and agreed that following termination of the employee's employment for any reason, the employee shall not hire or attempt to hire any current employees of the employer.",
    "(2) It is further acknowledged and agreed that following termination of the employee's employment, for any reason the employee shall not solicit business from current clients or clients who have retained in the 6-month period immediately preceding the employee's termination.",
    "",
    "17. APPLICABLE LAWS",
    "This agreement shall be governed by the laws of Kenya including but not limited to the Employment Act, Constitution of Kenya 2010 and any other applicable laws.",
    "",
    "18. ENTIRE AGREEMENT",
    "This agreement contains the entire agreement between the parties, superseding in all respects any and all prior oral or written agreements or understandings pertaining to the employment of the Employee by the Employer and shall be amended or modified only by written instrument signed by both of the parties hereto.",
    "",
    "19. SEVERABILITY",
    "The parties hereto agree that in the event any article or part thereof of this agreement is held to be unenforceable or invalid then said article or part shall be struck and all remaining provision shall remain in full force and effect.",
    "",
    "IN WITNESS WHEREOF the Employer has caused this agreement to be executed by its duly authorized officers and the Employee has set his hand as of the date first above written.",
    "",
    "SIGNED, SEALED AND DELIVERED in the presence of:",
    "",
    "[Stamp & Signature of Employer]",
    "",
    "[Name & Signature of Employee]",
    "",
    "[Date]",
    "",
    "DRAWN BY: CJ Law & Associates LLP, 10th Floor, Mitsumi Business Park, 67, Muthithi Road, Westlands, P.O. Box 38424-00100, Nairobi",
  ].join("\n");
}

module.exports = { buildEmploymentAgreement, numberToWords };
