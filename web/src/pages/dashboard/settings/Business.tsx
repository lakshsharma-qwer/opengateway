import { useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "../../../lib/api";
import { useAuth, useCan } from "../../../lib/auth";
import { useFetch } from "../../../lib/hooks";
import type { Settings } from "../../../lib/types";
import { Button, Card, ErrorBanner, Input, PageHeader, Select, Skeleton } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { BUSINESS_TYPES } from "../../Onboarding";

const FIELDS = ["business_name", "business_type", "phone", "website", "support_email", "support_phone"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

export default function Business() {
  const toast = useToast();
  const can = useCan();
  const { me, refresh } = useAuth();
  const { data, loading, error, reload } = useFetch<Settings>("/api/settings");
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(Object.fromEntries(FIELDS.map((k) => [k, (data[k] as string | null) ?? ""])) as Form);
  }, [data]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => form && setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.business_name.trim()) e.business_name = "Business name is required";
    if (form.support_email && !/^\S+@\S+\.\S+$/.test(form.support_email)) e.support_email = "Enter a valid email";
    if (form.website && !/^https?:\/\//.test(form.website)) e.website = "Start with https://";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.patch("/api/settings", Object.fromEntries(FIELDS.map((k) => [k, form[k].trim() || null])));
      toast.success("Business profile saved");
      refresh();
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Business profile" subtitle="Your name and support contacts appear on checkout and payment links." />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card className="max-w-3xl p-5 sm:p-6">
        {!form || loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input wrapClassName="sm:col-span-2" label="Business name" value={form.business_name} onChange={set("business_name")} error={errors.business_name} disabled={!can.write} />
              <Select label="Business type" value={form.business_type} onChange={set("business_type")} options={BUSINESS_TYPES} disabled={!can.write} />
              <Input label="Business phone" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} disabled={!can.write} />
              <Input wrapClassName="sm:col-span-2" label="Website" placeholder="https://" value={form.website} onChange={set("website")} error={errors.website} disabled={!can.write} />
              <Input label="Support email" type="email" value={form.support_email} onChange={set("support_email")} error={errors.support_email} hint="Shown to customers on checkout" disabled={!can.write} />
              <Input label="Support phone" type="tel" value={form.support_phone} onChange={set("support_phone")} error={errors.support_phone} disabled={!can.write} />
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
              <span className="font-mono text-xs text-ink-3">{me?.merchant.id}</span>
              {can.write && (
                <Button onClick={save} loading={busy}>
                  Save changes
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
