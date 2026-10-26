import Link from "next/link";

export const metadata = { title: "Terms of Use · koin" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10 text-sm leading-relaxed">
      <Link href="/login" className="text-xs font-bold text-accent">Back to sign in</Link>
      <div className="mb-6 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">DRAFT: prepared for review by a Kenyan lawyer before use. Replace the bracketed items with your company details.</div>
      <h1 className="text-2xl font-extrabold">Terms of Use</h1>
      <p className="text-gray-500">Last updated: [date].</p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">1. The service</h2>
        <p>koin is a workforce management system for attendance, leave, branches, employment records and payroll support. It is provided to employers and their staff.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">2. Accounts</h2>
        <p>Accounts are approved by an administrator. You must keep your sign-in details private and tell the administrator if you think they have been seen by anyone else.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">3. Payroll and legal advice</h2>
        <p>koin calculates pay using the rules and rates set in the system. Tax, pension and other statutory rates change. Employers are responsible for checking the figures with their accountant before paying staff. koin does not give legal, tax or accounting advice.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">4. Acceptable use</h2>
        <p>Use koin only for lawful employment and workforce purposes. Do not enter false records, try to access records you are not allowed to see, or interfere with the service.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">5. Availability</h2>
        <p>We work to keep koin available, but it may be unavailable at times for maintenance, hosting limits or circumstances outside our control. Keep your own copies of important records.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">6. Liability</h2>
        <p>[Limitation of liability wording to be agreed with your lawyer.]</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">7. Governing law</h2>
        <p>These terms are governed by the laws of Kenya. [Jurisdiction wording to be confirmed by your lawyer.]</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">8. Privacy</h2>
        <p>How personal data is handled is described in the <Link href="/privacy" className="font-bold text-accent">Privacy Policy</Link>.</p>
      </section>
    </main>
  );
}
