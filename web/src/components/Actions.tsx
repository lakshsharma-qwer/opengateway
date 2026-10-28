import { useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "../lib/api";
import type { Order, Refund } from "../lib/types";
import { formatINR } from "../lib/money";
import { AmountInput } from "./AmountInput";
import { Modal } from "./Overlay";
import { Button, Input, Select, Textarea } from "./ui";
import { useToast } from "./Toast";

const UTR_RE = /^\d{12}$/;

export function MarkPaidModal({ order, open, onClose, onDone }: { order: Order; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const u = utr.trim();
    if (u && !UTR_RE.test(u)) return setErr("UTR must be 12 digits");
    setBusy(true);
    try {
      await api.post(`/api/orders/${order.id}/mark-paid`, { utr: u || undefined, note: note.trim() || undefined });
      toast.success("Order marked as paid");
      onDone();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.field === "utr") setErr(e.message);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark as paid"
      description={`Only do this after you've seen ${formatINR(order.amount_payable)} arrive in your bank or UPI app. Your systems will be notified that this order is paid.${order.status === "expired" || order.status === "cancelled" ? ` This order is ${order.status}; marking it paid records a late payment.` : ""}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Input label="UTR" optional placeholder="12-digit UPI reference" inputMode="numeric" className="font-mono" value={utr} onChange={(e) => { setUtr(e.target.value.replace(/\D/g, "").slice(0, 12)); setErr(null); }} error={err} />
        <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Verified in HDFC app" />
      </div>
    </Modal>
  );
}

export function RejectPaymentModal({ paymentId, open, onClose, onDone }: { paymentId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("not_received");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/payments/${paymentId}/reject`, { reason: reason === "other" ? other.trim() || "other" : reason });
      toast.success("Payment rejected");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Reject this payment?"
      description="The customer said they paid, but you couldn't find the credit. The payment will fail and the order reopens so they can try again before it expires."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Reject payment
          </Button>
        </>
      }
    >
      <div className="space-y-3 pb-2">
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: "not_received", label: "Money not received" },
            { value: "wrong_amount", label: "Wrong amount received" },
            { value: "invalid_utr", label: "UTR doesn't match" },
            { value: "other", label: "Other" },
          ]}
        />
        {reason === "other" && <Input label="Describe the reason" value={other} onChange={(e) => setOther(e.target.value)} />}
      </div>
    </Modal>
  );
}

export function RefundModal({
  open,
  onClose,
  onDone,
  paymentId,
  maxAmount,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (r: Refund) => void;
  paymentId?: string;
  maxAmount?: number;
}) {
  const toast = useToast();
  const [pid, setPid] = useState(paymentId ?? "");
  const [amount, setAmount] = useState<number | null>(maxAmount ?? null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPid(paymentId ?? "");
      setAmount(maxAmount ?? null);
      setReason("");
      setErrors({});
    }
  }, [open, paymentId, maxAmount]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!pid.trim().startsWith("pay_")) e.payment_id = "Enter a payment ID (starts with pay_)";
    if (!amount || amount < 100) e.amount = "Minimum refund is ₹1.00";
    if (maxAmount != null && amount && amount > maxAmount) e.amount = `You can refund up to ${formatINR(maxAmount)}`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api.post<Refund>("/api/refunds", { payment_id: pid.trim(), amount, notes: reason.trim() ? { reason: reason.trim() } : {} });
      toast.success("Refund created. Send the money from your UPI app, then mark it processed.");
      onDone(r);
      onClose();
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
      title="Issue refund"
      description="OpenGateway records the refund. You send the money back to the customer from your own UPI app, then mark it processed with the UTR."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {maxAmount != null && amount === maxAmount ? "Issue full refund" : "Issue refund"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {!paymentId && <Input label="Payment ID" placeholder="pay_…" className="font-mono" value={pid} onChange={(e) => setPid(e.target.value)} error={errors.payment_id} />}
        <AmountInput label="Refund amount" value={amount} onChange={setAmount} error={errors.amount} hint={maxAmount != null ? `Refundable: ${formatINR(maxAmount)}` : undefined} />
        <Input label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item out of stock" />
      </div>
    </Modal>
  );
}

export function ProcessRefundModal({ refund, open, onClose, onDone }: { refund: Refund | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [utr, setUtr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setUtr("");
      setErr(null);
    }
  }, [open]);
  if (!refund) return null;
  const submit = async () => {
    if (utr && !UTR_RE.test(utr)) return setErr("UTR must be 12 digits");
    setBusy(true);
    try {
      await api.post(`/api/refunds/${refund.id}/process`, utr ? { utr } : {});
      toast.success("Refund marked processed");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Mark refund processed"
      description={`Confirm you've sent ${formatINR(refund.amount)} back to the customer.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Mark processed
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <Input label="Refund UTR" optional inputMode="numeric" className="font-mono" placeholder="12-digit UPI reference" value={utr} onChange={(e) => { setUtr(e.target.value.replace(/\D/g, "").slice(0, 12)); setErr(null); }} error={err} />
      </div>
    </Modal>
  );
}

export function CreateOrderModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (o: Order) => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [cust, setCust] = useState({ name: "", phone: "", email: "" });
  const [expire, setExpire] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!amount || amount < 100) e.amount = "Minimum amount is ₹1.00";
    else if (amount > 10000000) e.amount = "Maximum amount is ₹1,00,000.00";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const customer = Object.fromEntries(Object.entries(cust).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
      const o = await api.post<Order>("/api/orders", {
        amount,
        description: description.trim() || undefined,
        customer: Object.keys(customer).length ? customer : undefined,
        expire_in: expire ? Number(expire) : undefined,
      });
      toast.success("Order created");
      onDone(o);
      onClose();
      setAmount(null);
      setDescription("");
      setCust({ name: "", phone: "", email: "" });
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
      title="Create order"
      description="Creates a checkout you can open or share with the customer."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Create order
          </Button>
        </>
      }
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AmountInput value={amount} onChange={setAmount} error={errors.amount} autoFocus />
        </div>
        <Input wrapClassName="sm:col-span-2" label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
        <Input label="Customer name" optional value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
        <Input label="Customer phone" optional type="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
        <Input wrapClassName="sm:col-span-2" label="Customer email" optional type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
        <Select
          wrapClassName="sm:col-span-2"
          label="Expires in"
          value={expire}
          onChange={(e) => setExpire(e.target.value)}
          options={[
            { value: "", label: "Account default" },
            { value: "300", label: "5 minutes" },
            { value: "900", label: "15 minutes" },
            { value: "3600", label: "1 hour" },
            { value: "86400", label: "24 hours" },
          ]}
        />
      </div>
    </Modal>
  );
}
