import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Check, CheckCircle2, IndianRupee, MessageSquareText, PartyPopper } from "lucide-react";
import { api, ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Observer, Settings, Vpa, Collection } from "../lib/types";
import { Button, Card, Input, Select } from "../components/ui";
import { Logo } from "../components/Logo";
import { ForwarderInstructions, SmsPlayground } from "../components/Sms";
import { useToast } from "../components/Toast";
import { cx } from "../lib/format";

const STEPS = [
  { title: "Business details", icon: Building2 },
  { title: "UPI ID", icon: IndianRupee },
  { title: "Verification", icon: MessageSquareText },
  { title: "Done", icon: PartyPopper },
];

export const BUSINESS_TYPES = [
  { value: "", label: "Select a type" },
  { value: "individual", label: "Individual / freelancer" },
  { value: "proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership / LLP" },
  { value: "private_limited", label: "Private limited company" },
  { value: "ngo", label: "Trust / NGO" },
  { value: "other", label: "Other" },
];

export default function Onboarding() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, refresh } = useAuth();
  const [step, setStep] = useState(0);

  // step 1
  const [biz, setBiz] = useState({ business_name: me?.merchant.business_name ?? "", business_type: "", website: "", support_email: me?.user.email ?? "", support_phone: "" });
  // step 2
  const [vpa, setVpa] = useState({ vpa: "", payee_name: me?.merchant.business_name ?? "", label: "Primary" });
  const [existingVpa, setExistingVpa] = useState<Vpa | null>(null);
  // step 3
  const [observer, setObserver] = useState<Observer | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/api/settings", undefined, { mode: "test" })
      .then((s) =>
        setBiz((b) => ({
          business_name: s.business_name || b.business_name,
          business_type: s.business_type ?? "",
          website: s.website ?? "",
          support_email: s.support_email ?? b.support_email,
          support_phone: s.support_phone ?? s.phone ?? "",
        })),
      )
      .catch(() => undefined);
    api
      .get<Collection<Vpa>>("/api/vpas", undefined, { mode: "test" })
      .then((c) => {
        const d = c.items.find((v) => v.is_default) ?? c.items[0];
        if (d) setExistingVpa(d);
      })
      .catch(() => undefined);
  }, []);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.field) setErrors({ [e.field]: e.message });
    else toast.error(errorMessage(e));
  };

  const saveBusiness = async () => {
    const e: Record<string, string> = {};
    if (!biz.business_name.trim()) e.business_name = "Enter your business name";
    if (biz.support_email && !/^\S+@\S+\.\S+$/.test(biz.support_email)) e.support_email = "Enter a valid email";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.patch("/api/settings", {
        business_name: biz.business_name.trim(),
        business_type: biz.business_type || null,
        website: biz.website.trim() || null,
        support_email: biz.support_email.trim() || null,
        support_phone: biz.support_phone.trim() || null,
      }, { mode: "test" });
      setStep(1);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const saveVpa = async () => {
    if (existingVpa && !vpa.vpa) {
      setStep(2);
      return;
    }
    const e: Record<string, string> = {};
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.vpa.trim())) e.vpa = "Enter a UPI ID like yourname@okhdfcbank";
    if (!vpa.payee_name.trim()) e.payee_name = "Enter the name customers will see";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const v = await api.post<Vpa>("/api/vpas", { vpa: vpa.vpa.trim(), payee_name: vpa.payee_name.trim(), label: vpa.label.trim() || null, mode: "test" }, { mode: "test" });
      setExistingVpa(v);
      // Clear the field so coming back to this step offers "Continue", not a duplicate add.
      setVpa((cur) => ({ ...cur, vpa: "" }));
      toast.success("UPI ID added");
      setStep(2);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const createObserver = async () => {
    setBusy(true);
    try {
      const o = await api.post<Observer>("/api/observers", { name: "My phone", mode: "test" }, { mode: "test" });
      setObserver(o);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await api.patch("/api/settings", { onboarding_completed: true }, { mode: "test" });
      await refresh();
      nav("/dashboard", { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-5 sm:px-8">
        <Logo />
        <Link to="/dashboard" className="text-sm font-semibold text-ink-3 hover:text-ink">
          Skip for now
        </Link>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2">
              <div className={cx("h-1.5 rounded-full transition-colors", i <= step ? "bg-brand-600" : "bg-line")} />
              <div className={cx("flex items-center gap-1.5 text-xs font-semibold", i === step ? "text-brand-700" : i < step ? "text-ink-2" : "text-ink-3")} aria-current={i === step ? "step" : undefined}>
                {i < step ? <CheckCircle2 className="size-3.5 text-credit" /> : <s.icon className="size-3.5" />}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            </li>
          ))}
        </ol>

        <Card className="animate-fade-up p-6 sm:p-8" key={step}>
          {step === 0 && (
            <>
              <h1 className="text-2xl font-semibold">Tell us about your business</h1>
              <p className="mt-1 text-sm text-ink-3">Customers see this name and support contact on your checkout.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Input wrapClassName="sm:col-span-2" label="Business name" value={biz.business_name} onChange={(e) => setBiz({ ...biz, business_name: e.target.value })} error={errors.business_name} />
                <Select label="Business type" value={biz.business_type} onChange={(e) => setBiz({ ...biz, business_type: e.target.value })} options={BUSINESS_TYPES} />
                <Input label="Website" optional placeholder="https://" value={biz.website} onChange={(e) => setBiz({ ...biz, website: e.target.value })} error={errors.website} />
                <Input label="Support email" type="email" value={biz.support_email} onChange={(e) => setBiz({ ...biz, support_email: e.target.value })} error={errors.support_email} />
                <Input label="Support phone" type="tel" optional value={biz.support_phone} onChange={(e) => setBiz({ ...biz, support_phone: e.target.value })} error={errors.support_phone} />
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={saveBusiness} loading={busy}>
                  Save and continue
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-2xl font-semibold">Add the UPI ID you get paid on</h1>
              <p className="mt-1 text-sm leading-6 text-ink-3">
                Customers pay this UPI ID directly, so money reaches your bank account without passing through us. This one is for <b>test mode</b> — add your live UPI ID later in Settings.
              </p>
              {existingVpa && (
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-credit-soft px-4 py-3 text-sm text-credit">
                  <Check className="size-4" /> <span className="font-mono">{existingVpa.vpa}</span> is already set up as your default test UPI ID.
                </div>
              )}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Input wrapClassName="sm:col-span-2" label="UPI ID (VPA)" placeholder="yourshop@okhdfcbank" value={vpa.vpa} onChange={(e) => setVpa({ ...vpa, vpa: e.target.value })} error={errors.vpa} className="font-mono" autoCapitalize="off" spellCheck={false} />
                <Input label="Payee name" hint="Shown in the customer's UPI app" value={vpa.payee_name} onChange={(e) => setVpa({ ...vpa, payee_name: e.target.value })} error={errors.payee_name} />
                <Input label="Label" optional value={vpa.label} onChange={(e) => setVpa({ ...vpa, label: e.target.value })} />
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button onClick={saveVpa} loading={busy}>
                  {existingVpa && !vpa.vpa ? "Continue" : "Add UPI ID"}
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-semibold">Set up automatic verification</h1>
              <p className="mt-1 text-sm leading-6 text-ink-3">
                When a customer pays, your bank sends you a credit SMS. Forward those messages to OpenGateway and we'll match each one to its order automatically. No SMS forwarding? You can still confirm payments by hand from the dashboard.
              </p>
              <div className="mt-6">
                {observer?.ingest_url ? (
                  <ForwarderInstructions ingestUrl={observer.ingest_url} />
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-2 p-5">
                    <p className="text-sm text-ink-2">Create a private ingest URL for the phone that receives your bank SMS.</p>
                    <Button onClick={createObserver} loading={busy} icon={<MessageSquareText className="size-4" />}>
                      Create ingest URL
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-8 border-t border-line pt-6">
                <h2 className="text-base font-semibold">Try a sample SMS</h2>
                <p className="mb-4 text-sm text-ink-3">See what we read from a bank message.</p>
                <SmsPlayground compact />
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>{observer ? "Continue" : "I'll confirm manually for now"}</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="py-6 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-credit-soft text-credit" style={{ animation: "pop .45s both" }}>
                <Check className="size-8" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold">You're ready to accept test payments</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-3">
                Create a test order from Quick Collect, open the checkout and press "Simulate success" to see the whole flow end to end.
              </p>
              <Button className="mt-8" size="lg" onClick={finish} loading={busy}>
                Go to dashboard
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
