import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { api, ApiError, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { Button, Card, Input, PageHeader } from "../../../components/ui";
import { useToast } from "../../../components/Toast";

const EMPTY = { current_password: "", new_password: "", confirm: "" };

export default function Security() {
  const toast = useToast();
  const { me } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError("");
    const e: Record<string, string> = {};
    if (!f.current_password) e.current_password = "Enter your current password";
    if (f.new_password.length < 8) e.new_password = "Use at least 8 characters";
    else if (f.new_password === f.current_password) e.new_password = "Choose a password you haven't used here";
    if (f.confirm !== f.new_password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post("/api/auth/change-password", { current_password: f.current_password, new_password: f.new_password });
      setF(EMPTY);
      toast.success("Password changed. You've been signed out on other devices.");
    } catch (err) {
      if (err instanceof ApiError && err.field && err.field in EMPTY) setErrors({ [err.field]: err.message });
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Security" subtitle="Manage how you sign in to OpenGateway." />
      <Card className="max-w-xl p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Change password</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              For <span className="font-medium text-ink-2">{me?.user.email}</span>. Changing it signs you out everywhere else.
            </p>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input label="Current password" type="password" autoComplete="current-password" value={f.current_password} onChange={set("current_password")} error={errors.current_password} />
          <Input label="New password" type="password" autoComplete="new-password" value={f.new_password} onChange={set("new_password")} error={errors.new_password} hint="At least 8 characters" />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} error={errors.confirm} />
          {formError && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="flex justify-end border-t border-line pt-5">
            <Button type="submit" loading={busy}>
              Change password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
