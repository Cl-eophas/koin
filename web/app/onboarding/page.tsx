"use client";
import { useEffect, useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import { useRouter } from "next/navigation";
import { UploadCloud, Check, AlertCircle } from "lucide-react";
import { AgreementDocument } from "@/components/documents/AgreementDocument";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { endpoints } from "@/lib/api";

const STEPS = ["Personal Details", "Payroll Statutory", "Document Upload", "Contract Agreement"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i < current ? "bg-status-success text-black" : i === current ? "bg-accent text-black" : "bg-ink/10 text-gray-500"
              }`}
            >
              {i < current ? <Check size={16} /> : i + 1}
            </div>
            <span className={`hidden text-sm font-semibold sm:inline ${i <= current ? "text-ink" : "text-gray-600"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className="mx-3 h-px flex-1 bg-base-border" />}
        </div>
      ))}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm";
const labelCls = "mb-1.5 block text-xs font-bold uppercase text-gray-500";

function DocUploadSlot({ docType, label }: { docType: "national_id" | "kra_pin_certificate" | "profile_photo"; label: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus("error");
      setError("File too large (max 5MB).");
      return;
    }
    setStatus("uploading");
    setError(null);
    try {
      await endpoints.uploadDocument(docType, file);
      setFileName(file.name);
      setStatus("done");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Upload failed.");
    }
  }

  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-base-border py-8 text-center hover:border-accent/50">
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFile} />
      {status === "done" ? (
        <>
          <Check size={20} className="text-status-success" />
          <div className="text-sm font-semibold text-status-success">{label} uploaded</div>
          <div className="max-w-[90%] truncate text-xs text-gray-500">{fileName}</div>
        </>
      ) : status === "uploading" ? (
        <>
          <UploadCloud size={20} className="animate-pulse text-accent" />
          <div className="text-sm font-semibold">Uploading…</div>
        </>
      ) : (
        <>
          <UploadCloud size={20} className={status === "error" ? "text-status-danger" : "text-accent"} />
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-gray-500">{error || "PDF, JPG, PNG (Max 5MB)"}</div>
        </>
      )}
    </label>
  );
}

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [agreement, setAgreement] = useState<string | null>(null);
  useEffect(() => {
    endpoints.myContract().then((r: any) => setAgreement(r?.data?.pending_contract?.contract_text || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    phone: "", idNumber: "", kraPin: "", nssf: "", nhif: "", bankName: "", bankBranch: "", accountNumber: "",
  });

  // completeProfile requires an authenticated, approved+active account
  // (backend/middleware/auth.js authenticateAnyStatus) — i.e. someone the
  // admin already created via POST /api/auth/register, now logging in for
  // the first time to finish their HR/payroll details.
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await endpoints.completeProfile(form);
      // Record the signature for any contract issued to this person. Without this, the
      // contract stays unsigned and the person cannot clock in.
      const mine: any = await endpoints.myContract();
      const pending = mine?.data?.pending_contract;
      if (pending?._id) {
        await endpoints.acceptContract(pending._id);
      }
      router.push("/employee");
    } catch (e: any) {
      setError(e.message || "Could not complete profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-black">Y</div>
        <div>
          <div className="font-extrabold leading-tight"><BrandName /></div>
          <div className="text-[10px] uppercase text-gray-500">Workforce Hubs</div>
        </div>
      </div>

      <Stepper current={step} />

      <div className="rounded-2xl border border-base-border bg-base-card p-6">
        {step === 0 && (
          <>
            <h2 className="text-lg font-extrabold">Personal Profile Completion</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please fill in your primary identification and contact records to initialize your workspace profile.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Primary Phone * (e.g. +2547XXXXXXXX or 07XXXXXXXX)</label>
                <input value={form.phone} onChange={set("phone")} placeholder="+254712345678" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>National ID Number *</label>
                <input value={form.idNumber} onChange={set("idNumber")} placeholder="7-8 digits" className={inputCls} />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-lg font-extrabold">Statutory &amp; Payroll Configuration</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add your financial statutory numbers and bank details for automated salary disbursement.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>KRA PIN * (e.g. A012345678B)</label><input value={form.kraPin} onChange={set("kraPin")} className={inputCls} /></div>
              <div><label className={labelCls}>NSSF Number *</label><input value={form.nssf} onChange={set("nssf")} className={inputCls} /></div>
              <div><label className={labelCls}>NHIF Number *</label><input value={form.nhif} onChange={set("nhif")} className={inputCls} /></div>
              <div><label className={labelCls}>Bank Name *</label><input value={form.bankName} onChange={set("bankName")} className={inputCls} /></div>
              <div><label className={labelCls}>Bank Branch *</label><input value={form.bankBranch} onChange={set("bankBranch")} className={inputCls} /></div>
              <div><label className={labelCls}>Account Number *</label><input value={form.accountNumber} onChange={set("accountNumber")} className={inputCls} /></div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-extrabold">Official Document Verification</h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload valid digital scans of your formal government credentials to establish visual legitimacy.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocUploadSlot docType="national_id" label="National ID Copy" />
              <DocUploadSlot docType="kra_pin_certificate" label="KRA PIN Certificate" />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Employment Contract Review</h2>
              <span className="rounded-md border border-accent/40 px-2 py-1 text-[11px] font-bold text-accent">
                {user?.role?.toUpperCase() || "STAFF"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Please read and accept the following operational terms and service agreements below.
            </p>
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-base-border bg-base-bg p-4 text-sm text-gray-400">
              <p className="font-bold text-ink">EMPLOYMENT AGREEMENT AND UNDERTAKING</p>
              <p className="mt-2">
                This agreement governs the relationship between YPPEOPLE Workforce Hubs and the undersigned employee.
              </p>
              <p className="mt-2">
                1. DUTIES AND STANDARDS: The employee shall execute operational duties diligently according to
                designated shift rosters.
              </p>
              <p className="mt-2">
                2. COMPENSATION AND REMITTANCE: Wages are structured on standard monthly schedules, processed via
                the statutory payroll details submitted in Step 2.
              </p>
              <p className="mt-2">
                3. DATA COMPLIANCE &amp; ACCURACY: By signing, you confirm that all personal, statutory, and document
                uploads provided during onboarding are true, complete and verifiable.
              </p>
            </div>
            {agreement && <div className="mb-5 max-h-[60vh] overflow-y-auto"><AgreementDocument text={agreement} /></div>}
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-accent" />
              I have read, understood, and agree to the operational and legal terms outlined above.
            </label>
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-between">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl bg-ink/10 px-5 py-3 text-sm font-bold disabled:opacity-40"
          >
            Go Back
          </button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))}>Save &amp; Continue</Button>
          ) : (
            <Button disabled={!agreed || submitting} onClick={finish}>
              {submitting ? "Submitting..." : "Accept & Complete Onboarding"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
