import { useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { api, ApiError, errorMessage, itemsOf } from "../../../lib/api";
import { useAuth, useCan } from "../../../lib/auth";
import { useFetch } from "../../../lib/hooks";
import type { Collection, Role, TeamMember } from "../../../lib/types";
import { fmtDate } from "../../../lib/format";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Select } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { ConfirmModal, Modal } from "../../../components/Overlay";
import { useToast } from "../../../components/Toast";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Everything, including team and refunds" },
  { value: "developer", label: "Developer", desc: "API keys, webhooks and data — no team or refunds" },
  { value: "viewer", label: "Viewer", desc: "Read-only access" },
];

export default function Team() {
  const toast = useToast();
  const can = useCan();
  const { me } = useAuth();
  const { data, loading, error, reload } = useFetch<Collection<TeamMember>>("/api/team");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const changeRole = async (m: TeamMember, role: Role) => {
    try {
      await api.patch(`/api/team/${m.id}`, { role });
      toast.success(`${m.name} is now ${role}`);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Member",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{m.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="font-semibold">
              {m.name} {m.id === me?.user.id && <span className="text-xs font-normal text-ink-3">(you)</span>}
            </div>
            <div className="text-xs text-ink-3">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (m) =>
        m.role === "owner" || !can.team || m.id === me?.user.id ? (
          <Badge tone={m.role === "owner" ? "brand" : "neutral"} className="capitalize">
            {m.role}
          </Badge>
        ) : (
          <select
            aria-label={`Role for ${m.name}`}
            value={m.role}
            onChange={(e) => changeRole(m, e.target.value as Role)}
            className="h-8 rounded-lg border border-line-2 bg-white px-2 text-sm hover:border-brand-300 focus:border-brand-500 focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        ),
    },
    { key: "added", header: "Added", hideOnMobile: true, cell: (m) => <span className="text-ink-2">{fmtDate(m.created_at, false)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (m) =>
        can.team && m.role !== "owner" && m.id !== me?.user.id ? (
          <Button size="sm" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}>
            <Trash2 className="size-4 text-danger" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Give staff and developers their own login with the access they need."
        actions={
          can.team && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
              Add member
            </Button>
          )
        }
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        <DataTable columns={columns} rows={itemsOf(data)} loading={loading && !data} rowKey={(m) => m.id} empty={<EmptyState icon={<Users className="size-5" />} title="Just you so far" />} />
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.value} className="rounded-2xl border border-line bg-white p-4">
            <div className="text-sm font-semibold">{r.label}</div>
            <div className="mt-0.5 text-xs leading-5 text-ink-3">{r.desc}</div>
          </div>
        ))}
      </div>
      <InviteModal open={inviting} onClose={() => setInviting(false)} onDone={reload} />
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="They'll be signed out and lose access to this account immediately."
        confirmLabel="Remove member"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.del(`/api/team/${removing.id}`);
            toast.success("Member removed");
            setRemoving(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", role: "developer" as Role, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Enter their name";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email";
    if (f.password.length < 8) e.password = "Use at least 8 characters";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post("/api/team", { ...f, name: f.name.trim(), email: f.email.trim() });
      toast.success(`${f.name.trim()} added. Share the temporary password with them securely.`);
      setF({ name: "", email: "", role: "developer", password: "" });
      onClose();
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add team member"
      description="They can log in right away with this email and temporary password."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Add member
          </Button>
        </>
      }
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} hint={ROLES.find((r) => r.value === f.role)?.desc} />
        <Input label="Temporary password" type="text" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} hint="At least 8 characters" />
      </div>
    </Modal>
  );
}
