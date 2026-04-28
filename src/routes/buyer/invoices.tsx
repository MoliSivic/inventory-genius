import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { StatusBadge } from "@/components/app/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney, formatUnits, useStore } from "@/lib/store";

export const Route = createFileRoute("/buyer/invoices")({
  component: BuyerInvoicesPage,
});

type ArchiveFilter = "active" | "archived" | "all";

function BuyerInvoicesPage() {
  const { state, currentBuyer } = useStore();
  const [archiveFilter, setArchiveFilter] = usePersistedState<ArchiveFilter>(
    "buyer_invoice_archive_filter",
    "active",
  );
  const allCustomerInvoices = state.sales
    .filter((sale) => sale.customerId === currentBuyer?.customerId)
    .sort((left, right) => right.date.localeCompare(left.date));
  const invoices = allCustomerInvoices.filter((sale) => {
    const isArchived = Boolean(sale.archivedAt);
    if (archiveFilter === "active") return !isArchived;
    if (archiveFilter === "archived") return isArchived;
    return true;
  });
  const archivedCount = allCustomerInvoices.filter((sale) => sale.archivedAt).length;
  const totalInvoiced = invoices.reduce((sum, sale) => sum + sale.total, 0);
  const totalPaid = invoices.reduce((sum, sale) => sum + sale.paidAmount, 0);
  const totalBalance = invoices.reduce(
    (sum, sale) => sum + Math.max(sale.total - sale.paidAmount, 0),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {invoices.length} receipts from {state.shopName}
        </p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          size="sm"
          variant={archiveFilter === "active" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setArchiveFilter("active")}
        >
          Active
        </Button>
        <Button
          type="button"
          size="sm"
          variant={archiveFilter === "archived" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setArchiveFilter("archived")}
        >
          Archived
          {archivedCount > 0 ? ` (${archivedCount})` : ""}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={archiveFilter === "all" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setArchiveFilter("all")}
        >
          All
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard label="Total" value={fmtMoney(totalInvoiced)} />
        <SummaryCard label="Paid" value={fmtMoney(totalPaid)} />
        <SummaryCard label="Balance" value={fmtMoney(totalBalance)} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {invoices.map((sale) => {
          const balance = Math.max(sale.total - sale.paidAmount, 0);

          return (
            <article
              key={sale.id}
              className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{sale.receiptNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(sale.date).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={sale.paymentStatus} />
              </div>
              {sale.archivedAt && (
                <Badge className="mt-3 border-transparent bg-muted text-muted-foreground">
                  Archived
                </Badge>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-sm">
                <MoneyLine label="Total" value={sale.total} />
                <MoneyLine label="Paid" value={sale.paidAmount} />
                <MoneyLine label="Balance" value={balance} danger={balance > 0} />
              </div>

              <div className="mt-3 space-y-2">
                {sale.items.map((item) => {
                  const product = state.products.find(
                    (candidate) => candidate.id === item.productId,
                  );
                  return (
                    <div
                      key={`${sale.id}-${item.productId}`}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium">{product?.name ?? "Product"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {formatUnits(item.unit)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold">{fmtMoney(item.quantity * item.unitPrice)}</p>
                        <p className="text-xs text-muted-foreground">{fmtMoney(item.unitPrice)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

        {invoices.length === 0 && (
          <div className="rounded-md border border-border bg-card p-8 text-center lg:col-span-2">
            <ReceiptText className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {archiveFilter === "archived" ? "No archived invoices" : "No invoices yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Confirmed sales from the seller will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "danger" ? "mt-1 truncate font-bold text-destructive" : "mt-1 truncate font-bold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function MoneyLine({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={danger ? "mt-1 truncate font-bold text-destructive" : "mt-1 truncate font-bold"}
      >
        {fmtMoney(value)}
      </p>
    </div>
  );
}
