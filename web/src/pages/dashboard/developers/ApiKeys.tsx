import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { useFetch } from "../../../lib/hooks";
import { api, errorMessage, itemsOf } from "../../../lib/api";
import { useCan } from "../../../lib/auth";
import { useMode } from "../../../lib/mode";
import type { ApiKey, Collection } from "../../../lib/types";
import { fmtDate, fmtRelative } from "../../../lib/format";
import { Button, Card, EmptyState, ErrorBanner, IdCell, PageHeader, SecretBox, StatusBadge } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { ConfirmModal, Modal } from "../../../components/Overlay";
import { useToast } from "../../../components/Toast";

export default function ApiKeys() {
  const toast = useToast();
  const can = useCan();
  const { mode } = useMode();
  const { data, loading, error, reload } = useFetch<Collection<ApiKey>>("/api/api-keys");
  const [confirmGen, setConfirmGen] = useState(false);
  const [secret, setSecret] = useState<{ key_id: string; key_secret: string } | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const keys = itemsOf(data);
  const active = keys.find((k) => k.status === "active");

  const generate = async () => {
    try {
      const k = await api.post<ApiKey & { key_id?: string; key_secret: string }>("/api/api-keys", { mode });
      setConfirmGen(false);
      setSecret({ key_id: k.key_id ?? k.id, key_secret: k.key_secret });
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<ApiKey>[] = [
    { key: "id", header: "Key ID", cell: (k) => <IdCell id={k.id} /> },
    { key: "status", header: "Status", cell: (k) => <StatusBadge status={k.status} /> },
    { key: "created", header: "Created", cell: (k) => <span className="text-ink-2">{fmtDate(k.created_at)}</span> },
    { key: "used", header: "Last used", cell: (k) => <span className="text-ink-2">{fmtRelative(k.last_used_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (k) =>
        k.status === "active" && can.developer ? (
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setRevoking(k)}>
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="API keys"
        subtitle={`Authenticate server-to-server calls to /v1 with HTTP Basic auth (key ID : secret). Showing ${mode} keys.`}
        actions={
          can.developer && (
            <Button icon={<Plus className="size-4" />} onClick={() => (active ? setConfirmGen(true) : generate())}>
              Generate {mode} key
            </Button>
          )
        }
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        <DataTable
          columns={columns}
          rows={keys}
          loading={loading && !data}
          rowKey={(k) => k.id}
          empty={
            <EmptyState
              icon={<KeyRound className="size-5" />}
              title={`No ${mode} keys`}
              description={mode === "live" ? "Generate a live key once live mode is activated." : "Generate a key to start calling the API."}
              action={can.developer ? <Button onClick={generate}>Generate key</Button> : undefined}
            />
          }
        />
      </Card>
      <div className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm leading-6 text-ink-2">
        <b>Keep secrets on your server.</b> The active key's secret also signs the <code className="rounded bg-brand-50 px-1 font-mono text-xs text-brand-800">og_signature</code> sent back to your return URL, so regenerating a key changes how you verify new payments.
      </div>

      <ConfirmModal
        open={confirmGen}
        onClose={() => setConfirmGen(false)}
        tone="primary"
        title="Generate a new key?"
        description={
          <>
            Your current {mode} key <span className="font-mono">{active?.id}</span> will be <b>deactivated immediately</b>. Any server still using it will start getting 401 errors, and new checkout signatures will use the new secret.
          </>
        }
        confirmLabel="Generate and deactivate old key"
        onConfirm={generate}
      />
      <Modal
        open={!!secret}
        onClose={() => setSecret(null)}
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-5 text-brand-600" /> New {mode} API key
          </span>
        }
        description="Copy the secret now — it won't be shown again."
        footer={<Button onClick={() => setSecret(null)}>I've saved it</Button>}
      >
        {secret && (
          <div className="space-y-3 pb-2">
            <SecretBox label="Key ID" value={secret.key_id} />
            <SecretBox label="Key secret" value={secret.key_secret} />
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
        description="Requests using it will fail right away and checkout redirects won't be signed until you generate a new key."
        confirmLabel="Revoke key"
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await api.post(`/api/api-keys/${revoking.id}/revoke`);
            toast.success("Key revoked");
            setRevoking(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
