"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Shirt, Wallet, ArrowLeftRight, LogOut, X, AlertCircle, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { demoProfile } from "@/lib/demoData";
import { mapProfile } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EmploymentTerms } from "@/components/employee/EmploymentTerms";
import { AppearancePanel } from "@/components/layout/AppearancePanel";
import { MyRecords } from "@/components/employee/MyRecords";
import { RecordsSearch } from "@/components/records/RecordsSearch";
import { useToast } from "@/components/ui/Toast";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-base-border py-3 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

const BADGE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  verified: { label: "Verified", tone: "success" },
  pending: { label: "Pending Review", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  not_submitted: { label: "Not Submitted", tone: "neutral" },
};

export default function ProfilePage() {
  const { logout, demoMode, user } = useAuth();
  const [live, setLive] = useState<ReturnType<typeof mapProfile>>(null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await endpoints.profile();
      setLive(mapProfile(res.data));
      setRaw(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const p = live || demoProfile;
  const vStatus: string = raw?.verification_status || (demoMode ? "verified" : "not_submitted");
  const badge = BADGE[vStatus] || BADGE.not_submitted;
  const initials = (p.fullName || "?").trim().split(/\s+/).slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join("");

  return (
    <div className="space-y-5">
      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/20 text-lg font-bold text-blue-300">{initials}</div>
        <div>
          <div className="flex items-center gap-2 font-bold">
            {p.fullName} <StatusBadge label={badge.label} tone={badge.tone} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-md bg-blue-500/15 px-2 py-0.5 font-bold text-blue-300">{(user?.role || "STAFF").toUpperCase()}</span>
            ID: {p.staffId}
          </div>
        </div>
      </div>

      {vStatus === "rejected" && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-status-danger"><AlertCircle size={16} /> Your profile was rejected</div>
          <p className="mt-1 text-gray-300">{raw?.verification_rejection_reason || "An admin found a problem with your details."}</p>
          <button onClick={() => setEditing(true)} className="mt-3 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black">Fix my details &amp; resubmit</button>
        </div>
      )}
      {vStatus === "pending" && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-xs font-semibold text-status-warning">
          Your details are awaiting admin verification. Spotted a mistake? You can still correct it below.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/employee/uniforms"><Card className="flex flex-col items-center gap-2 py-4 text-center"><Shirt size={20} className="text-accent" /><span className="text-xs font-bold">Uniforms</span></Card></Link>
        <Link href="/employee/pay"><Card className="flex flex-col items-center gap-2 py-4 text-center"><Wallet size={20} className="text-accent" /><span className="text-xs font-bold">Pay Summary</span></Card></Link>
      </div>

      {raw?.employment_type === "casual" && (
      <Link href="/employee/branch-transfer">
        <Card className="flex items-center gap-3"><ArrowLeftRight size={18} className="text-accent" /><span className="text-sm font-bold">Branches &amp; Opportunities</span></Card>
      </Link>
      )}

      <div className="mb-5"><RecordsSearch search={(p) => endpoints.myRecords(p)} /></div>

      <MyRecords />

      <Link href="/employee/messages"><Card className="mb-5 flex items-center gap-3"><MessageSquare size={18} className="text-accent" /><span className="text-sm font-bold">Messages</span></Card></Link>
      <div>
        <div className="mb-5"><EmploymentTerms /></div>
        <div className="mb-5"><AppearancePanel /></div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Personal Details</div>
        <Card>
          <Row label="Full Name" value={p.fullName} />
          <Row label="Email Address" value={p.email} />
          <Row label="Phone Number" value={p.phone} />
          <Row label="Branch Assignment" value={p.branch} />
        </Card>
      </div>
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Payroll Details</div>
        <Card>
          <Row label="KRA PIN" value={p.kraPin} />
          <Row label="NSSF Number" value={p.nssf} />
          <Row label="NHIF Number" value={p.nhif} />
          <Row label="Bank Name" value={p.bankName} />
          <Row label="Account Number" value={p.accountNumber} />
        </Card>
      </div>
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Contract Summary</div>
        <Card>
          <Row label="Contract Type" value={p.contractType} />
          <Row label="Start Date" value={p.startDate} />
          <Row label="Status" value={p.status} />
        </Card>
      </div>

      <button onClick={() => setEditing(true)} disabled={demoMode || !raw} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-accent py-3 font-bold text-accent disabled:opacity-40">
        <Pencil size={16} /> Edit Profile Data
      </button>
      <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-status-danger/40 py-3 font-bold text-status-danger">
        <LogOut size={16} /> Sign Out
      </button>

      {editing && raw && <EditProfileModal raw={raw} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

const KRA_RE = /^[A-Z][0-9]{9}[A-Z]$/;
const PHONE_RE = /^(\+254|0)[0-9]{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function EditProfileModal({ raw, onClose, onSaved }: { raw: any; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const initial = {
    fullName: raw.name || "",
    email: raw.email || "",
    phone: raw.phone || "",
    idNumber: raw.idNumber || "",
    kraPin: raw.kraPin || "",
    nssf: raw.nssf || "",
    nhif: raw.nhif || "",
    bankName: raw.bank?.bankName || "",
    bankBranch: raw.bank?.branch || "",
    accountNumber: raw.bank?.accountNumber || "",
  };
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const bankChanged = f.bankName.trim() !== initial.bankName || f.bankBranch.trim() !== initial.bankBranch || f.accountNumber.trim() !== initial.accountNumber;
  const wasVerified = raw.verification_status === "verified";

  // Mirrors the server rules so people get instant feedback.
  function validate(): string | null {
    if (!f.fullName.trim()) return "Full name is required.";
    if (!EMAIL_RE.test(f.email.trim())) return "Enter a valid email address.";
    if (!PHONE_RE.test(f.phone.trim())) return "Phone must look like +2547XXXXXXXX or 07XXXXXXXX.";
    if (!/^[0-9]{7,8}$/.test(f.idNumber.trim())) return "National ID must be 7–8 digits.";
    if (!KRA_RE.test(f.kraPin.trim().toUpperCase())) return "KRA PIN must look like A012345678B (letter, 9 digits, letter).";
    if (!f.nssf.trim()) return "NSSF number is required.";
    if (!f.nhif.trim()) return "NHIF/SHA number is required.";
    if (!f.bankName.trim() || !f.bankBranch.trim()) return "Bank name and branch are required.";
    if (f.accountNumber.trim().length < 6) return "Account number must be at least 6 characters.";
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      const res: any = await endpoints.updateFullProfile({ ...f, kraPin: f.kraPin.trim().toUpperCase() });
      show(res.message || "Profile updated", "success");
      onSaved();
    } catch (e: any) {
      setError(e.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, k: keyof typeof initial, ph = "") => (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{label}</label>
      <input value={f[k]} onChange={set(k)} placeholder={ph} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm placeholder:text-gray-600" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-base-border bg-base-surface p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Edit My Details</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-3">
          {field("Full Name", "fullName")}
          {field("Email", "email")}
          {field("Phone", "phone", "+2547XXXXXXXX")}
          {field("National ID Number", "idNumber", "7–8 digits")}
          {field("KRA PIN", "kraPin", "A012345678B")}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field("NSSF Number", "nssf")}
            {field("NHIF / SHA Number", "nhif")}
          </div>
          {field("Bank Name", "bankName")}
          {field("Bank Branch", "bankBranch")}
          {field("Account Number", "accountNumber")}
        </div>
        {bankChanged && (
          <p className="mt-3 rounded-lg bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
            Changing bank details marks your bank as unverified until an admin re-verifies it.
          </p>
        )}
        {!bankChanged && wasVerified && <p className="mt-3 text-xs text-gray-500">Non-bank corrections keep your verified status.</p>}
        {!wasVerified && <p className="mt-3 text-xs text-gray-500">Saving will (re)submit your profile for admin verification.</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
