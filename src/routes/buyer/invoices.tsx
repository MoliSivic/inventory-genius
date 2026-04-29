import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney, formatUnits, useStore } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/invoices")({
  component: BuyerInvoicesPage,
});

type ArchiveFilter = "active" | "archived" | "all";

const paymentLabels: Record<Sale["paymentStatus"], string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

const paymentClasses: Record<Sale["paymentStatus"], string> = {
  paid: "bg-success/15 text-success",
  partial: "bg-warning/20 text-warning-foreground",
  unpaid: "bg-destructive/15 text-destructive",
};

function BuyerInvoicesPage() {
  const { state, currentBuyer } = useStore();
  const [archiveFilter, setArchiveFilter] = usePersistedState<ArchiveFilter>(
    "buyer_invoice_archive_filter",
    "active",
  );
  const buyerOrderBySaleId = new Map(
    state.buyerOrders.filter((order) => order.saleId).map((order) => [order.saleId, order]),
  );
  const allCustomerInvoices = state.sales
    .filter((sale) => {
      if (sale.customerId !== currentBuyer?.customerId) return false;
      const linkedOrder = buyerOrderBySaleId.get(sale.id);
      return !linkedOrder || linkedOrder.buyerId === currentBuyer?.id;
    })
    .sort((left, right) => right.date.localeCompare(left.date));
  const invoices = allCustomerInvoices.filter((sale) => {
    const isArchived = Boolean(sale.archivedAt);
    if (archiveFilter === "active") return !isArchived;
    if (archiveFilter === "archived") return isArchived;
    return true;
  });
  const archivedCount = allCustomerInvoices.filter((sale) => sale.archivedAt).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {invoices.length} official receipt{invoices.length === 1 ? "" : "s"} from {state.shopName}
          . Payments update after delivery.
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

      <div className="space-y-3">
        {invoices.map((sale) => {
          const customer = state.customers.find((item) => item.id === sale.customerId);
          const remaining = Math.max(sale.total - sale.paidAmount, 0);

          return (
            <article
              key={sale.id}
              className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                      {sale.receiptNumber}
                    </h2>
                    <Badge
                      className={cn(
                        "rounded-full border-transparent px-3 py-1 text-sm font-semibold",
                        paymentClasses[sale.paymentStatus],
                      )}
                    >
                      {paymentLabels[sale.paymentStatus]}
                    </Badge>
                    {sale.archivedAt && (
                      <Badge className="rounded-full border-transparent bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                        Archived
                      </Badge>
                    )}
                  </div>
                  <p className="mt-4 text-base font-medium text-muted-foreground sm:text-lg">
                    {customer?.name ?? currentBuyer?.name ?? "Customer"}
                    {(customer?.market ?? currentBuyer?.market)
                      ? ` - ${customer?.market ?? currentBuyer?.market}`
                      : ""}
                  </p>
                  {(customer?.phone || currentBuyer?.phone) && (
                    <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                      {customer?.phone || currentBuyer?.phone}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">{sale.date}</p>
                </div>
                <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground sm:text-base">
                  {state.shopName}
                </p>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm sm:text-base">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground sm:text-sm">
                      <th className="py-3 pr-4 font-semibold">Product</th>
                      <th className="py-3 pr-4 text-right font-semibold">Qty</th>
                      <th className="py-3 pr-4 text-right font-semibold">Price</th>
                      <th className="py-3 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, index) => {
                      const product = state.products.find(
                        (candidate) => candidate.id === item.productId,
                      );
                      return (
                        <tr
                          key={`${sale.id}-${item.productId}-${index}`}
                          className="border-b border-border/70"
                        >
                          <td className="py-4 pr-4 align-top">
                            <p className="font-semibold">{product?.name ?? "Product"}</p>
                            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                              {product?.category ?? ""}
                            </p>
                          </td>
                          <td className="py-4 pr-4 text-right align-top">
                            {item.quantity} {formatUnits(item.unit)}
                          </td>
                          <td className="py-4 pr-4 text-right align-top">
                            {fmtMoney(item.unitPrice)}
                          </td>
                          <td className="py-4 text-right align-top font-bold">
                            {fmtMoney(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-4 border-t border-border pt-4 text-base lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                <p className="text-muted-foreground">
                  {sale.notes ? `Note: ${sale.notes}` : "No note"}
                </p>
                <div className="space-y-2">
                  <PaymentLine label="Subtotal" value={sale.total} />
                  <PaymentLine label="Paid" value={sale.paidAmount} />
                  <PaymentLine
                    label={remaining > 0 ? "Remaining" : "Remaining"}
                    value={remaining}
                    danger={remaining > 0}
                  />
                  <div className="flex items-center justify-between rounded-md bg-muted px-3 py-3 font-bold">
                    <span>Total</span>
                    <span>{fmtMoney(sale.total)}</span>
                  </div>
                  {sale.paymentStatus === "partial" && (
                    <p className="text-right text-sm font-medium text-warning-foreground">
                      Partially paid: {fmtMoney(sale.paidAmount)} paid, {fmtMoney(remaining)} left
                    </p>
                  )}
                  {sale.paymentStatus === "unpaid" && (
                    <p className="text-right text-sm font-medium text-destructive">
                      Unpaid: {fmtMoney(remaining)} remaining
                    </p>
                  )}
                  {sale.paymentStatus === "paid" && (
                    <p className="text-right text-sm font-medium text-success">Paid in full</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {invoices.length === 0 && (
          <div className="rounded-md border border-border bg-card p-8 text-center">
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

function PaymentLine({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm sm:text-base">
      <span className="text-muted-foreground">{label}</span>
      <span className={danger ? "font-bold text-destructive" : "font-semibold"}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}
