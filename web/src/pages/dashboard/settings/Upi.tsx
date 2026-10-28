import { useState } from "react";
import { BadgeIndianRupee, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api, ApiError, errorMessage, itemsOf } from "../../../lib/api";
import { useCan } from "../../../lib/auth";
import { useFetch } from "../../../lib/hooks";
import { useMode } from "../../../lib/mode";
import type { Collection, Vpa } from "../../../lib/types";
import { fmtDate } from "../../../lib/format";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Switch } from "../../../components/ui";
import { ConfirmModal, Modal } from "../../../components/Overlay";
import { useToast } from "../../../components/Toast";

const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export default function Upi() {
  const toast = useToast();
  const can = useCan();
  const { mode } = useMode();
  const { data, loading, error, reload } = useFetch<Collection<Vpa>>("/api/vpas");
  const [editing, setEditing] = useState<Vpa | "new" | null>(null);
  const [deleting, setDeleting] = useState<Vpa | null>(null);
  const vpas = itemsOf(data);

  const patch = async (v: Vpa, body: Partial<Vpa>, msg: string) => {
    try {
      await api.patch(`/api/vpas/${v.id}`, body);
      toast.success(msg);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="UPI accounts"
        subtitle={`The UPI IDs customers pay in ${mode} mode. Money goes straight to these accounts.`}
        actions={
          can.write && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Add UPI ID
            </Button>
          )
        }
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <div className="space-y-3 p-5">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
        ) : vpas.length ? (
          <ul className="divide-y divide-line">
            {vpas.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 font-display font-bold text-brand-700">₹</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[15px] font-semibold">{v.vpa}</span>
                    {v.is_default && (
                      <Badge tone="brand">
                        <Star className="size-3 fill-current" /> Default
                      </Badge>
                    )}
                    {!v.active && <Badge>Inactive</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {v.payee_name}
                    {v.label && ` · ${v.label}`} · added {fmtDate(v.created_at, false)}
                  </div>
                </div>
                {can.write && (
                  <div className="flex items-center gap-2">
                    <Switch checked={v.active} onChange={(a) => patch(v, { active: a }, a ? "UPI ID activated" : "UPI ID deactivated")} label={<span className="sr-only">Active</span>} />
                    {!v.is_default && v.active && (
                      <Button size="sm" variant="outline" onClick={() => patch(v, { is_default: true }, "Default UPI ID updated")}>
                        Set default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={`Edit ${v.vpa}`} onClick={() => setEditing(v)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${v.vpa}`} onClick={() => setDeleting(v)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BadgeIndianRupee className="size-5" />}
            title={`No ${mode} UPI IDs`}
            description={mode === "live" ? "Add the UPI ID real customers will pay to activate live mode." : "Add a UPI ID to start creating test orders."}
            action={can.write ? <Button onClick={() => setEditing("new")}>Add UPI ID</Button> : undefined}
          />
        )}
      </Card>
      <p className="mt-3 text-xs leading-5 text-ink-3">New orders use the default UPI ID unless your API call passes a <code className="font-mono">vpa_id</code>. Inactive IDs can't receive new orders.</p>

      <VpaModal value={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.vpa ?? ""}?`}
        description="Existing orders keep their UPI ID. New orders can't use it."
        confirmLabel="Remove UPI ID"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.del(`/api/vpas/${deleting.id}`);
            toast.success("UPI ID removed");
            setDeleting(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function VpaModal({ value, onClose, onSaved }: { value: Vpa | "new" | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { mode } = useMode();
  const isNew = value === "new";
  const [f, setF] = useState({ vpa: "", payee_name: "", label: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = value === null ? null : value === "new" ? "new" : value.id;
  if (key !== lastKey) {
    setLastKey(key);
    setErrors({});
    if (value && value !== "new") setF({ vpa: value.vpa, payee_name: value.payee_name, label: value.label ?? "" });
    else setF({ vpa: "", payee_name: "", label: "" });
  }

  const save = async () => {
    const e: Record<string, string> = {};
    if (isNew && !VPA_RE.test(f.vpa.trim())) e.vpa = "Enter a UPI ID like shop@okhdfcbank";
    if (!f.payee_name.trim()) e.payee_name = "Enter the payee name";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (isNew) await api.post("/api/vpas", { vpa: f.vpa.trim(), payee_name: f.payee_name.trim(), label: f.label.trim() || null, mode });
      else await api.patch(`/api/vpas/${(value as Vpa).id}`, { payee_name: f.payee_name.trim(), label: f.label.trim() || null });
      toast.success(isNew ? "UPI ID added" : "UPI ID updated");
      onClose();
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={isNew ? `Add ${mode} UPI ID` : "Edit UPI ID"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? "Add UPI ID" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Input label="UPI ID (VPA)" className="font-mono" placeholder="shop@okhdfcbank" value={f.vpa} disabled={!isNew} onChange={(e) => setF({ ...f, vpa: e.target.value })} error={errors.vpa} autoCapitalize="off" spellCheck={false} />
        <Input label="Payee name" hint="Should match the name on the bank account" value={f.payee_name} onChange={(e) => setF({ ...f, payee_name: e.target.value })} error={errors.payee_name} />
        <Input label="Label" optional placeholder="e.g. Counter, Online store" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      </div>
    </Modal>
  );
}
