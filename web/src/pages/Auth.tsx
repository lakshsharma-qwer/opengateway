import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { api, ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Input, SecretBox } from "../components/ui";
import { Modal } from "../components/Overlay";
import { Logo } from "../components/Logo";

interface SignupResponse {
  test_key?: { key_id: string; key_secret: string };
}

export default function Auth({ kind }: { kind: "login" | "signup" }) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", business_name: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testKey, setTestKey] = useState<{ key_id: string; key_secret: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (kind === "signup") {
      if (!form.name.trim()) e.name = "Enter your name";
      if (!form.business_name.trim()) e.business_name = "Enter your business name";
      if (!/^\+?\d[\d\s-]{8,14}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number";
      if (form.password.length < 8) e.password = "Use at least 8 characters";
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email";
    if (kind === "login" && !form.password) e.password = "Enter your password";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy(true);
    try {
      if (kind === "signup") {
        const r = await api.post<SignupResponse>("/api/auth/signup", {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          business_name: form.business_name.trim(),
          phone: form.phone.trim(),
        });
        if (r.test_key) {
          setTestKey(r.test_key);
        } else {
          await refresh();
          nav("/onboarding");
        }
      } else {
        await api.post("/api/auth/login", { email: form.email.trim(), password: form.password });
        const me = await refresh();
        const next = sp.get("next");
        nav(next && next.startsWith("/") ? next : me && !me.merchant.onboarding_completed ? "/onboarding" : "/dashboard", { replace: true });
      }
    } catch (e) {
      if (e instanceof ApiError && e.field) setErrors({ [e.field]: e.message });
      else setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finishSignup = async () => {
    await refresh();
    nav("/onboarding", { replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col">
        <div className="grid-dots absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)]" />
        <Link to="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-[40px] leading-[1.05] font-semibold">Every rupee lands in your own bank account.</p>
          <p className="mt-4 text-brand-200">Customers pay your UPI ID directly. We create the order, show the QR, verify the credit and tell your systems — at 0% fees.</p>
          <div className="mt-10 rounded-2xl bg-white/8 p-4 font-mono text-[12.5px] leading-6 text-brand-100 ring-1 ring-white/10">
            <div className="text-brand-300">HDFCBK · now</div>
            Rs.499.01 credited to a/c XX4421 by VPA priya@okaxis. UPI Ref 412345678901
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 font-sans text-xs font-semibold text-emerald-300">
              <ShieldCheck className="size-3.5" /> Matched order_8fK2… · paid
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-[28px] font-semibold">{kind === "signup" ? "Create your account" : "Log in to OpenGateway"}</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {kind === "signup" ? (
              <>
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
                  Log in
                </Link>
              </>
            ) : (
              <>
                New to OpenGateway?{" "}
                <Link to="/signup" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {kind === "signup" && (
              <>
                <Input label="Your name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
                <Input label="Business name" autoComplete="organization" value={form.business_name} onChange={set("business_name")} error={errors.business_name} hint="Shown to customers on checkout" />
                <Input label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} placeholder="98765 43210" />
              </>
            )}
            <Input label="Work email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
            <Input
              label="Password"
              type="password"
              autoComplete={kind === "signup" ? "new-password" : "current-password"}
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              hint={kind === "signup" ? "At least 8 characters" : undefined}
            />
            {formError && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {kind === "signup" ? "Create account" : "Log in"}
            </Button>
          </form>
          {kind === "signup" && <p className="mt-6 text-xs leading-5 text-ink-3">You start in test mode with sample-safe data. Go live once you add your UPI ID.</p>}
        </div>
      </main>

      <Modal
        open={!!testKey}
        onClose={finishSignup}
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-5 text-brand-600" /> Your test API key
          </span>
        }
        description="Copy the secret now. For your security we show it only once — if you lose it, generate a new key from Developers → API Keys."
        footer={<Button onClick={finishSignup}>I've saved it, continue</Button>}
      >
        {testKey && (
          <div className="space-y-3 pb-2">
            <SecretBox label="Key ID" value={testKey.key_id} />
            <SecretBox label="Key secret" value={testKey.key_secret} />
          </div>
        )}
      </Modal>
    </div>
  );
}
