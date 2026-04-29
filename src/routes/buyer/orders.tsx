import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, getBuyerOrderDisplayTotals, useStore } from "@/lib/store";
import type { BuyerOrderStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/orders")({
  component: BuyerOrdersPage,
});

const statusLabels: Record<BuyerOrderStatus, string> = {
  pending: "Sent",
  confirmed: "Confirmed",
  packing: "Loading",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClasses: Record<BuyerOrderStatus, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  confirmed: "bg-primary/15 text-primary",
  packing: "bg-secondary text-secondary-foreground",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

const statusDescriptions: Record<BuyerOrderStatus, string> = {
  pending: "Sent to the seller.",
  confirmed: "Seller confirmed it for loading.",
  packing: "Being loaded for delivery.",
  completed: "Loaded and receipt created.",
  cancelled: "Cancelled by the seller.",
};

const paymentLabels: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

const paymentClasses: Record<PaymentStatus, string> = {
  paid: "bg-success/15 text-success",
  partial: "bg-warning/20 text-warning-foreground",
  unpaid: "bg-destructive/15 text-destructive",
};

function BuyerOrdersPage() {
  const { state, currentBuyer } = useStore();
  const orders = state.buyerOrders
    .filter((order) => order.buyerId === currentBuyer?.id)
    .sort((left, right) => right.date.localeCompare(left.date));

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">{orders.length} orders</p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const { receipt, total, paidAmount, remaining, paymentStatus } =
            getBuyerOrderDisplayTotals(state, order);

          return (
            <article
              key={order.id}
              className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight">{order.orderNumber}</h2>
                    <Badge className={cn("border-transparent", statusClasses[order.status])}>
                      {statusLabels[order.status]}
                    </Badge>
                    {receipt && (
                      <Badge className={cn("border-transparent", paymentClasses[paymentStatus])}>
                        {paymentLabels[paymentStatus]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(order.date).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {statusDescriptions[order.status]}
                  </p>
                  {receipt && (
                    <div className="mt-2 rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                      <p className="font-semibold">Receipt: {receipt.receiptNumber}</p>
                      <p>Invoices and Debt use this receipt as the money record.</p>
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-muted px-3 py-2 text-sm font-semibold">
                  {total > 0 ? fmtMoney(total) : "Price confirm"}
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => {
                      const product = state.products.find(
                        (candidate) => candidate.id === item.productId,
                      );
                      return (
                        <tr
                          key={`${order.id}-${item.productId}-${index}`}
                          className="border-b border-border/60"
                        >
                          <td className="px-3 py-2">
                            <p className="font-medium">{product?.name ?? "Product"}</p>
                            <p className="text-xs text-muted-foreground">
                              {product?.category ?? ""}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.estimatedUnitPrice === undefined
                              ? "Confirm"
                              : fmtMoney(item.estimatedUnitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {item.estimatedUnitPrice === undefined
                              ? "Confirm"
                              : fmtMoney(item.estimatedUnitPrice * item.quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid gap-2 rounded-md bg-muted p-3 text-sm sm:grid-cols-3">
                <MoneyCell label={receipt ? "Receipt total" : "Order estimate"} value={total} />
                <MoneyCell label="Paid" value={paidAmount} />
                <MoneyCell label="Remaining" value={remaining} danger={remaining > 0} />
              </div>

              {(order.notes || order.sellerNote) && (
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {order.notes && (
                    <p className="rounded-md bg-muted/70 p-2">Your note: {order.notes}</p>
                  )}
                  {order.sellerNote && (
                    <p className="rounded-md bg-muted/70 p-2">Seller note: {order.sellerNote}</p>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {orders.length === 0 && (
          <div className="rounded-md border border-border bg-card p-8 text-center">
            <PackageCheck className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No orders yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders you send from the product page will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate font-bold", danger && "text-destructive")}>
        {fmtMoney(value)}
      </p>
    </div>
  );
}
