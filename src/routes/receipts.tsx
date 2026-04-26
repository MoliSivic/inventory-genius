import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, fmtMoney } from "@/lib/store";
import { PageHeader, PageSection, StatusBadge } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt } from "@/components/app/Receipt";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";
import type { Sale, TelegramStatus } from "@/lib/types";

export const Route = createFileRoute("/receipts")({ component: ReceiptsPage });

const tgLabel: Record<TelegramStatus, string> = {
  not_sent: "Not sent",
  customer: "Sent to customer",
  owner: "Sent to owner",
  both: "Sent to both",
  failed: "Failed",
};

function ReceiptsPage() {
  const { state, updateSaleTelegram } = useStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [viewing, setViewing] = useState<Sale | null>(null);

  const filtered = state.sales.filter((s) => {
    if (status !== "all" && s.paymentStatus !== status) return false;
    if (search) {
      const c = state.customers.find((x) => x.id === s.customerId);
      const q = search.toLowerCase();
      if (!s.receiptNumber.toLowerCase().includes(q) && !c?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Receipts" description="Full receipt history with Telegram share status." />
      <PageSection>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search receipt or customer..." className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[800px]">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="px-5 py-2 font-medium">Receipt</th>
              <th className="px-5 py-2 font-medium">Customer</th>
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium text-right">Total</th>
              <th className="px-5 py-2 font-medium">Payment</th>
              <th className="px-5 py-2 font-medium">Telegram</th>
              <th className="px-5 py-2 font-medium text-right">Action</th>
            </tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2 font-mono text-xs">{s.receiptNumber}</td>
                  <td className="px-5 py-2">{state.customers.find((c) => c.id === s.customerId)?.name ?? "—"}</td>
                  <td className="px-5 py-2">{s.date}</td>
                  <td className="px-5 py-2 text-right font-medium">{fmtMoney(s.total)}</td>
                  <td className="px-5 py-2"><StatusBadge status={s.paymentStatus} /></td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{tgLabel[s.telegramStatus]}</td>
                  <td className="px-5 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setViewing(s)}>View</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No receipts.</td></tr>}
            </tbody>
          </table>
        </div>
      </PageSection>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {viewing && <Receipt sale={viewing} customer={state.customers.find((c) => c.id === viewing.customerId)} products={state.products} shopName={state.shopName} />}
          <DialogFooter className="flex-wrap gap-2">
            {viewing && (["customer", "owner", "both"] as const).map((opt) => (
              <Button key={opt} size="sm" variant="secondary" onClick={() => { updateSaleTelegram(viewing.id, opt); toast.success("Receipt is ready to share through Telegram."); }}>
                <Send className="h-3 w-3 mr-1" />{opt === "both" ? "Both" : `Send to ${opt}`}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}