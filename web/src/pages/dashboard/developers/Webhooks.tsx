import { useEffect, useState } from "react";
import { Eye, History, Pencil, Plus, RotateCw, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { useFetch } from "../../../lib/hooks";
import { api, ApiError, errorMessage, itemsOf } from "../../../lib/api";
import { useCan } from "../../../lib/auth";
import { useMode } from "../../../lib/mode";
import { EVENT_TYPES, type Collection, type WebhookDelivery, type WebhookEndpoint } from "../../../lib/types";
import { cx, fmtDate, fmtRelative } from "../../../lib/format";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Mono, PageHeader, SecretBox, StatusBadge, Switch } from "../../../components/ui";
import { ConfirmModal, Drawer, Modal } from "../../../components/Overlay";
import { useToast } from "../../../components/Toast";

export default function Webhooks() {
  const toast = useToast();
  const can = useCan();
  const { mode } = useMode();
  const { data, loading, error, reload } = useFetch<Collection<WebhookEndpoint>>("/api/webhooks");
  const [editing, setEditing] = useState<WebhookEndpoint | "new" | null>(null);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookEndpoint | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const hooks = itemsOf(data);

  const reveal = async (w: WebhookEndpoint) => {
    try {
      const r = await api.post<{ secret: string }>(`/api/webhooks/${w.id}/reveal-secret`);
      setSecret({ title: "Signing secret", value: r.secret });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const test = async (w: WebhookEndpoint) => {
    setTesting(w.id);
    try {
      await api.post(`/api/webhooks/${w.id}/test`);
      toast.success("Test ping sent. Check deliveries for the response.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle={`Get a signed POST to your server when payments happen. Showing ${mode} endpoints.`}
        actions={
          can.developer && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Add endpoint
            </Button>
          )
        }
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? (
        <div className="space-y-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      ) : hooks.length ? (
        <div className="space-y-3">
          {hooks.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="truncate font-mono text-sm font-semibold text-ink">{w.url}</code>
                    <StatusBadge status={w.active ? "active" : "inactive"} />
                    {w.failure_count > 0 && <Badge tone="danger">{w.failure_count} failing</Badge>}
                  </div>
                  {w.description && <p className="mt-1 text-sm text-ink-3">{w.description}</p>}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {(w.events.includes("*") ? ["All events"] : w.events).map((e) => (
                      <span key={e} className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-800">
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 text-xs text-ink-3">
                    <Mono className="text-xs">{w.id}</Mono> · last delivery {fmtRelative(w.last_delivery_at)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" icon={<History className="size-3.5" />} onClick={() => setDeliveries(w)}>
                    Deliveries
                  </Button>
                  {can.developer && (
                    <>
                      <Button size="sm" variant="outline" icon={<Send className="size-3.5" />} loading={testing === w.id} onClick={() => test(w)}>
                        Send test
                      </Button>
                      <Button size="sm" variant="outline" icon={<Eye className="size-3.5" />} onClick={() => reveal(w)}>
                        Secret
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Edit endpoint" onClick={() => setEditing(w)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Delete endpoint" onClick={() => setDeleting(w)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<WebhookIcon className="size-5" />}
            title="No webhook endpoints"
            description="Add an HTTPS URL on your server to get order.paid and other events as they happen."
            action={can.developer ? <Button onClick={() => setEditing("new")}>Add endpoint</Button> : undefined}
          />
        </Card>
      )}

      <EndpointModal
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(w, created) => {
          reload();
          if (created && w.secret) setSecret({ title: "Endpoint created — copy the signing secret", value: w.secret });
        }}
      />
      <Modal open={!!secret} onClose={() => setSecret(null)} title={secret?.title ?? ""} description="Use this secret to verify the X-OpenGateway-Signature header on each delivery." footer={<Button onClick={() => setSecret(null)}>Done</Button>}>
        {secret && (
          <div className="pb-2">
            <SecretBox label="Signing secret" value={secret.value} />
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this endpoint?"
        description="Pending retries to it are dropped and no new events will be sent."
        confirmLabel="Delete endpoint"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.del(`/api/webhooks/${deleting.id}`);
            toast.success("Endpoint deleted");
            setDeleting(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <DeliveriesDrawer endpoint={deliveries} onClose={() => setDeliveries(null)} />
    </div>
  );
}

function EndpointModal({ value, onClose, onSaved }: { value: WebhookEndpoint | "new" | null; onClose: () => void; onSaved: (w: WebhookEndpoint, created: boolean) => void }) {
  const toast = useToast();
  const { mode } = useMode();
  const isNew = value === "new";
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [all, setAll] = useState(false);
  const [events, setEvents] = useState<string[]>(["order.paid"]);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return;
    setErrors({});
    if (value === "new") {
      setUrl("");
      setDescription("");
      setAll(false);
      setEvents(["order.paid", "payment.failed", "refund.processed"]);
      setActive(true);
    } else {
      setUrl(value.url);
      setDescription(value.description ?? "");
      setAll(value.events.includes("*"));
      setEvents(value.events.filter((e) => e !== "*"));
      setActive(value.active);
    }
  }, [value]);

  const toggle = (e: string) => setEvents((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]));

  const save = async () => {
    const er: Record<string, string> = {};
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) er.url = "Use an http(s) URL";
    } catch {
      er.url = "Enter a full URL, e.g. https://example.com/webhooks/opengateway";
    }
    if (!all && !events.length) er.events = "Pick at least one event";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const body = { url: url.trim(), description: description.trim() || null, events: all ? ["*"] : events, ...(isNew ? { mode } : { active }) };
    try {
      const w = isNew ? await api.post<WebhookEndpoint>("/api/webhooks", body) : await api.patch<WebhookEndpoint>(`/api/webhooks/${(value as WebhookEndpoint).id}`, body);
      toast.success(isNew ? "Endpoint added" : "Endpoint updated");
      onClose();
      onSaved(w, isNew);
    } catch (e) {
      if (e instanceof ApiError && e.field) setErrors({ [e.field]: e.message });
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      size="lg"
      title={isNew ? "Add webhook endpoint" : "Edit webhook endpoint"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {isNew ? "Add endpoint" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Input label="Endpoint URL" placeholder="https://yourstore.com/webhooks/opengateway" value={url} onChange={(e) => setUrl(e.target.value)} error={errors.url} className="font-mono" />
        <Input label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-2">Events to send</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand-600" checked={all} onChange={(e) => setAll(e.target.checked)} /> All events
            </label>
          </div>
          <div className={cx("grid gap-1.5 sm:grid-cols-2", all && "pointer-events-none opacity-50")}>
            {EVENT_TYPES.map((e) => (
              <label key={e} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 hover:bg-paper">
                <input type="checkbox" className="size-4 accent-brand-600" checked={all || events.includes(e)} onChange={() => toggle(e)} disabled={all} />
                <span className="font-mono text-[12.5px]">{e}</span>
              </label>
            ))}
          </div>
          {errors.events && <p className="mt-1.5 text-xs font-medium text-danger">{errors.events}</p>}
        </div>
        {!isNew && <Switch checked={active} onChange={setActive} label="Active" description="Paused endpoints receive no deliveries." />}
      </div>
    </Modal>
  );
}

function DeliveriesDrawer({ endpoint, onClose }: { endpoint: WebhookEndpoint | null; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, reload } = useFetch<Collection<WebhookDelivery>>(endpoint ? `/api/webhooks/${endpoint.id}/deliveries` : null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const items = itemsOf(data);

  const resend = async (d: WebhookDelivery) => {
    setResending(d.id);
    try {
      await api.post(`/api/webhook-deliveries/${d.id}/resend`);
      toast.success("Delivery queued again");
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setResending(null);
    }
  };

  return (
    <Drawer open={!!endpoint} onClose={onClose} width="lg" title="Deliveries" subtitle={endpoint?.url}>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="outline" icon={<RotateCw className="size-3.5" />} onClick={reload} loading={loading}>
          Refresh
        </Button>
      </div>
      {loading && !data ? (
        <div className="space-y-2">
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
        </div>
      ) : items.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {items.map((d) => (
            <li key={d.id}>
              <button onClick={() => setOpenId(openId === d.id ? null : d.id)} aria-expanded={openId === d.id} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-paper">
                <StatusBadge status={d.status} />
                <span className="font-mono text-[12.5px] font-semibold">{d.event_type}</span>
                <span className="ml-auto text-xs text-ink-3">{fmtDate(d.created_at)}</span>
                <span className="w-full text-xs text-ink-3">
                  HTTP {d.response_status ?? "—"} · {d.attempts} attempt{d.attempts === 1 ? "" : "s"}
                  {d.duration_ms != null && ` · ${d.duration_ms} ms`}
                  {d.status === "pending" && d.next_attempt_at && ` · next retry ${fmtDate(d.next_attempt_at)}`}
                </span>
              </button>
              {openId === d.id && (
                <div className="space-y-3 border-t border-line bg-paper/60 px-4 py-3">
                  <div className="text-xs text-ink-3">
                    Delivery <Mono className="text-xs">{d.id}</Mono> · event <Mono className="text-xs">{d.event_id}</Mono>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-ink-3">Response body</div>
                    <pre className="max-h-48 overflow-auto rounded-lg bg-ink p-3 font-mono text-[11.5px] leading-5 whitespace-pre-wrap text-brand-100">{d.response_body || "(empty)"}</pre>
                  </div>
                  <Button size="sm" variant="outline" icon={<RotateCw className="size-3.5" />} loading={resending === d.id} onClick={() => resend(d)}>
                    Resend
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<History className="size-5" />} title="No deliveries yet" description="Send a test ping to see one here." />
      )}
    </Drawer>
  );
}
