import Link from "next/link";

export const metadata = { title: "Privacy Policy · koin" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10 text-sm leading-relaxed">
      <Link href="/login" className="text-xs font-bold text-accent">Back to sign in</Link>
      <div className="mb-6 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">DRAFT: prepared for review by a Kenyan lawyer before use. Replace the bracketed items with your company details.</div>
      <h1 className="text-2xl font-extrabold">Privacy Policy</h1>
      <p className="text-gray-500">Last updated: [date]. This policy explains how koin handles personal data for employers and their staff.</p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Who is responsible</h2>
        <p>The employer using koin (the customer) decides why and how staff data is used, and is the data controller. koin provides the system and processes data on the customer&apos;s instructions. Contact the employer for requests about your own employment records. [Customer name, address, contact].</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Identity and contact details: name, work email, phone, address, staff ID.</li>
          <li>Employment details: branch, position, start date, contract terms, leave, reviews.</li>
          <li>Pay and payments: salary, deductions, bank or M-Pesa account numbers.</li>
          <li>Statutory numbers: national ID number, KRA PIN, NSSF and SHA numbers, where the employer requires them.</li>
          <li>Attendance: clock-in and clock-out times, and the location recorded when clocking in.</li>
          <li>Documents: ID scans, KRA certificates and medical notes for sick leave.</li>
          <li>System records: messages, notifications and an audit log of changes.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Why we use it</h2>
        <p>To run attendance, leave, payroll and payments, to meet statutory obligations, to manage employment records and to keep the system secure. We do not sell personal data and do not use it for advertising.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Who we share it with</h2>
        <p>Only the services needed to run koin:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>MongoDB Atlas: database storage.</li>
          <li>Render: backend hosting.</li>
          <li>Netlify: web app hosting.</li>
          <li>Brevo: sending email (password resets, verification and alerts).</li>
          <li>Google: optional sign-in with a Google account. Google shares your name and email with us.</li>
          <li>OpenStreetMap: map tiles and address lookup on the branch pages. No staff personal data is sent to it.</li>
          <li>UptimeRobot: checks the system is online. It receives no personal data.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">How long we keep it</h2>
        <p>Each employer sets how long records stay searchable in the system. Older records are removed or archived after that period, after a copy is downloaded. Payroll records are kept for the period required by law and the employer&apos;s accountant. [Retention periods agreed with the employer].</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Your rights</h2>
        <p>You can ask to see, correct or delete your personal data. Staff can download a copy of their own records from their profile page. For corrections and deletion requests, contact your employer, who can request changes from koin. [Your contact for data requests].</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Cookies and local storage</h2>
        <p>koin uses only cookies needed to keep you signed in securely. It stores your theme and colour choice on your device. koin does not use advertising or tracking cookies.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Security</h2>
        <p>Data is sent over HTTPS, passwords are stored in hashed form, access is limited by role, and changes are recorded in an audit log.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Changes to this policy</h2>
        <p>We will update this page when the system or the way data is used changes.</p>
      </section>
    </main>
  );
}
