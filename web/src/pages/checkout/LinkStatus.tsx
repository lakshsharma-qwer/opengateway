import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { formatINR } from "../../lib/money";
import { LogoMark } from "../../components/Logo";

interface LinkInfo {
  status: "active" | "paid" | "expired" | "cancelled";
  amount: number;
  description: string | null;
  merchant: { name: string; logo_url: string | null; brand_color: string | null };
}

const COPY = {
  paid: { title: "This link has been paid", text: "Thanks — the payment was received and verified.", icon: CheckCircle2, cls: "bg-credit-soft text-credit" },
  expired: { title: "This payment link has expired", text: "Ask the merchant to send you a new link.", icon: Clock3, cls: "bg-paper text-ink-3" },
  cancelled: { title: "This payment link was cancelled", text: "The merchant cancelled this request. Nothing is due on it.", icon: Ban, cls: "bg-paper text-ink-3" },
  active: { title: "This link is still open", text: "You can complete the payment now.", icon: Clock3, cls: "bg-brand-50 text-brand-600" },
} as const;

export default function LinkStatus() {
  const { code = "" } = useParams();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<LinkInfo>(`/api/public/links/${encodeURIComponent(code)}`)
      .then(setInfo)
      .catch((e) => setError(errorMessage(e)));
  }, [code]);

  const brand = info?.merchant.brand_color && /^#[0-9a-f]{6}$/i.test(info.merchant.brand_color) ? info.merchant.brand_color : "#5f259f";
  const c = info ? COPY[info.status] : null;

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ background: `linear-gradient(180deg, ${brand}14 0, transparent 300px), var(--color-paper)` }}>
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl bg-white text-center shadow-pop">
          {!info && !error && (
            <div className="grid h-72 place-items-center">
              <Loader2 className="size-6 animate-spin text-brand-600" />
            </div>
          )}
          {error && (
            <div className="p-8">
              <h1 className="text-xl font-semibold">Link not found</h1>
              <p className="mt-2 text-sm text-ink-3">{error}</p>
            </div>
          )}
          {info && c && (
            <>
              <div className="px-6 pt-7 pb-6 text-white" style={{ background: brand }}>
                {info.merchant.logo_url ? (
                  <img src={info.merchant.logo_url} alt="" className="mx-auto size-12 rounded-xl bg-white object-contain p-1" />
                ) : (
                  <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white/15 font-display text-xl font-bold">{info.merchant.name.slice(0, 1)}</span>
                )}
                <div className="mt-3 font-display text-lg font-semibold">{info.merchant.name}</div>
                <div className="mt-1 font-display text-3xl font-semibold tabular">{formatINR(info.amount)}</div>
                {info.description && <p className="mt-1 text-sm opacity-80">{info.description}</p>}
              </div>
              <div className="px-6 py-8">
                <div className={`mx-auto grid size-14 place-items-center rounded-full ${c.cls}`}>
                  <c.icon className="size-7" />
                </div>
                <h1 className="mt-4 text-xl font-semibold">{c.title}</h1>
                <p className="mt-1.5 text-sm text-ink-3">{c.text}</p>
                {info.status === "active" && (
                  <a href={`/l/${encodeURIComponent(code)}`} className="mt-5 inline-flex h-11 items-center rounded-xl px-6 font-semibold text-white" style={{ background: brand }}>
                    Pay {formatINR(info.amount)}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-3">
          <LogoMark className="size-4" /> <ShieldCheck className="size-3.5" /> Powered by OpenGateway
        </p>
      </div>
    </div>
  );
}
