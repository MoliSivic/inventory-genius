import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, fmtMoney, customerTotals } from "@/lib/store";
import { PageHeader, PageSection, StatusBadge } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { displayZeroAsPlaceholder, parseNumericInput } from "@/lib/utils";
import { toast } from "sonner";
import type { Sale } from "@/lib/types";

export const Route = createFileRoute("/debts")({ component: DebtsPage });

function DebtsPage() {
  const { state, recordPayment } = useStore();
  const [paying, setPaying] = useState<Sale | null>(null);
  const [amount, setAmount] = useState(0);

  const unpaid = state.sales.filter((s) => s.paymentStatus !== "paid");

  return (
    <div>
      <PageHeader title="Debt Tracking" description="Outstanding balances by customer and sale." />

      <PageSection title="Customers with Debt">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="px-5 py-2 font-medium">Customer</th>
              <th className="px-5 py-2 font-medium">Market</th>
              <th className="px-5 py-2 font-medium text-right">Total Sales</th>
              <th className="px-5 py-2 font-medium text-right">Debt</th>
            </tr></thead>
            <tbody>
              {state.customers.map((c) => {
                const t = customerTotals(state, c.id);
                if (t.debt <= 0) return null;
                return (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-medium">{c.name}</td>
                    <td className="px-5 py-2 text-muted-foreground">{c.market}</td>
                    <td className="px-5 py-2 text-right">{fmtMoney(t.totalSales)}</td>
                    <td className="px-5 py-2 text-right font-bold text-destructive">{fmtMoney(t.debt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>

      <div className="mt-6">
        <PageSection title="Unpaid / Partial Sales">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[700px]">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Receipt</th>
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium text-right">Total</th>
                <th className="px-5 py-2 font-medium text-right">Paid</th>
                <th className="px-5 py-2 font-medium text-right">Remaining</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">Action</th>
              </tr></thead>
              <tbody>
                {unpaid.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-5 py-2">{state.customers.find((c) => c.id === s.customerId)?.name ?? "—"}</td>
                    <td className="px-5 py-2">{s.date}</td>
                    <td className="px-5 py-2 text-right">{fmtMoney(s.total)}</td>
                    <td className="px-5 py-2 text-right">{fmtMoney(s.paidAmount)}</td>
                    <td className="px-5 py-2 text-right font-bold text-destructive">{fmtMoney(s.total - s.paidAmount)}</td>
                    <td className="px-5 py-2"><StatusBadge status={s.paymentStatus} /></td>
                    <td className="px-5 py-2 text-right"><Button size="sm" onClick={() => { setPaying(s); setAmount(s.total - s.paidAmount); }}>Record Payment</Button></td>
                  </tr>
                ))}
                {unpaid.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">No outstanding debts. 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </PageSection>
      </div>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {paying?.receiptNumber}</DialogTitle></DialogHeader>
          {paying && (
            <div className="space-y-3">
              <p className="text-sm">Remaining: <span className="font-bold text-destructive">{fmtMoney(paying.total - paying.paidAmount)}</span></p>
              <div><Label>Amount</Label><Input type="number" step="0.01" min={0} max={paying.total - paying.paidAmount} value={displayZeroAsPlaceholder(amount)} placeholder="0" onChange={(e) => setAmount(parseNumericInput(e.target.value))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!paying) return;
              if (amount <= 0) { toast.error("Enter an amount"); return; }
              recordPayment({ customerId: paying.customerId, saleId: paying.id, amount, date: new Date().toISOString().slice(0, 10) });
              toast.success("Payment recorded");
              setPaying(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
