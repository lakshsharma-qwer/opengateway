import { useEffect, useState } from "react";
import { Clock3, ShieldCheck } from "lucide-react";
import { api, ApiError, errorMessage } from "../../../lib/api";
import { useCan } from "../../../lib/auth";
import { useFetch } from "../../../lib/hooks";
import type { Settings } from "../../../lib/types";
import { fmtDuration } from "../../../lib/format";
import { Button, Card, ErrorBanner, Input, PageHeader, Select, Skeleton, Switch } from "../../../components/ui";
import { QR } from "../../../components/QR";
import { useToast } from "../../../components/Toast";

const SWATCHES = ["#5f259f", "#1a56c4", "#0b8a5f", "#c8323c", "#e0680f", "#0f766e", "#1c1029", "#9d174d"];
const EXPIRIES = [120, 300, 600, 900, 1800, 3600, 7200, 21600, 86400];

export default function CheckoutBranding() {
  const toast = useToast();
  const can = useCan();
  const { data, error, reload } = useFetch<Settings>("/api/settings");
  const [logo, setLogo] = useState("");
  const [color, setColor] = useState("#5f259f");
  const [expiry, setExpiry] = useState(900);
  const [unique, setUnique] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    if (!data) return;
    setLogo(data.logo_url ?? "");
    setColor(data.brand_color || "#5f259f");
    setExpiry(data.order_expiry_seconds || 900);
    setUnique(data.unique_amount ?? true);
  }, [data]);

  const validColor = /^#[0-9a-f]{6}$/i.test(color);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!validColor) e.brand_color = "Use a 6-digit hex like #5f259f";
    if (logo && !/^https?:\/\//.test(logo)) e.logo_url = "Use a full https:// image URL";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.patch("/api/settings", { logo_url: logo.trim() || null, brand_color: color.toLowerCase(), order_expiry_seconds: expiry, unique_amount: unique });
      toast.success("Checkout settings saved");
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const name = data?.business_name || "Your business";
  const brand = validColor ? color : "#5f259f";

  return (
    <div>
      <PageHeader title="Checkout & branding" subtitle="How your checkout looks and behaves for customers." />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5 sm:p-6">
          {!data ? (
            <div className="space-y-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold">Brand</h2>
                <div className="mt-3 space-y-4">
                  <Input
                    label="Logo URL"
                    optional
                    placeholder="https://yourstore.com/logo.png"
                    value={logo}
                    onChange={(e) => {
                      setLogo(e.target.value);
                      setLogoOk(true);
                    }}
                    error={errors.logo_url ?? (!logoOk && logo ? "This image couldn't be loaded" : null)}
                    hint="Square image, at least 128×128 px"
                    disabled={!can.write}
                  />
                  <div>
                    <label htmlFor="brand-hex" className="text-[13px] font-semibold text-ink-2">
                      Brand colour
                    </label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <input type="color" aria-label="Pick brand colour" value={brand} onChange={(e) => setColor(e.target.value)} disabled={!can.write} className="h-10 w-12 cursor-pointer rounded-lg border border-line-2 bg-white p-1" />
                      <input
                        id="brand-hex"
                        value={color}
                        onChange={(e) => setColor(e.target.value.trim())}
                        disabled={!can.write}
                        className="h-10 w-28 rounded-xl border border-line-2 px-3 font-mono text-sm uppercase focus:border-brand-500 focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {SWATCHES.map((s) => (
                          <button
                            key={s}
                            aria-label={`Use ${s}`}
                            disabled={!can.write}
                            onClick={() => setColor(s)}
                            className="size-7 rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-line-2"
                            style={{ background: s, boxShadow: color.toLowerCase() === s ? `0 0 0 2px #fff, 0 0 0 4px ${s}` : undefined }}
                          />
                        ))}
                      </div>
                    </div>
                    {errors.brand_color && <p className="mt-1 text-xs text-danger">{errors.brand_color}</p>}
                    <button onClick={() => setColor("#5f259f")} className="mt-2 text-xs font-semibold text-brand-700 hover:underline" disabled={!can.write}>
                      Back to default
                    </button>
                  </div>
                </div>
              </section>

              <section className="border-t border-line pt-6">
                <h2 className="text-sm font-semibold">Payment behaviour</h2>
                <div className="mt-3 space-y-5">
                  <Select
                    label="Default order expiry"
                    value={String(expiry)}
                    onChange={(e) => setExpiry(Number(e.target.value))}
                    options={(EXPIRIES.includes(expiry) ? EXPIRIES : [...EXPIRIES, expiry].sort((a, b) => a - b)).map((s) => ({ value: String(s), label: fmtDuration(s) }))}
                    hint="Used when an order doesn't set expire_in. Shorter windows match faster and free up amounts sooner."
                    disabled={!can.write}
                    wrapClassName="max-w-xs"
                  />
                  <Switch
                    checked={unique}
                    onChange={setUnique}
                    disabled={!can.write}
                    label="Unique payable amounts"
                    description="Adds up to 99 paise when two open orders on the same UPI ID have the same amount, so each bank credit matches exactly one order. Turn off only if you always collect UTRs."
                  />
                </div>
              </section>

              {can.write && (
                <div className="flex justify-end border-t border-line pt-5">
                  <Button onClick={save} loading={busy}>
                    Save changes
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">Live preview</div>
          <div className="overflow-hidden rounded-3xl bg-white shadow-pop ring-1 ring-line">
            <div className="perforated relative px-5 pt-5 pb-6 text-white" style={{ background: brand }}>
              <div className="flex items-center gap-2.5">
                {logo && logoOk && /^https?:\/\/\S+$/i.test(logo) ? (
                  <img src={logo} alt="" onError={() => setLogoOk(false)} className="size-9 rounded-lg bg-white object-contain p-0.5" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-lg bg-white/15 font-display font-bold">{name.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <div className="font-display text-[15px] font-semibold">{name}</div>
                  <div className="text-[11px] opacity-75">Receipt #1042</div>
                </div>
              </div>
              <div className="mt-5 text-[10px] font-semibold tracking-[0.14em] uppercase opacity-70">Amount payable</div>
              <div className="font-display text-4xl font-semibold tabular">
                ₹499<span className="text-xl opacity-70">.01</span>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-semibold">
                <Clock3 className="size-3" /> Expires in {fmtDuration(expiry)}
              </span>
              <span className="notch-l" style={{ ["--notch-bg" as string]: "#fff" }} />
              <span className="notch-r" style={{ ["--notch-bg" as string]: "#fff" }} />
            </div>
            <div className="flex flex-col items-center px-5 py-5">
              <div className="text-sm font-semibold">Scan with any UPI app</div>
              <div className="mt-3 rounded-xl border border-line p-3">
                <QR value="upi://pay?pa=preview@upi&pn=Preview&am=499.01&cu=INR" size={128} />
              </div>
              <button className="mt-4 h-10 w-full rounded-xl text-sm font-semibold text-white" style={{ background: brand }} tabIndex={-1}>
                I have paid
              </button>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-ink-3">
                <ShieldCheck className="size-3" /> Secured by OpenGateway
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
