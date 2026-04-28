import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, useStore } from "@/lib/store";
import type { BuyerOrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/orders")({
  component: BuyerOrdersPage,
});

const statusLabels: Record<BuyerOrderStatus, string> = {
  pending: "Sent",
  confirmed: "Confirmed",
  packing: "Packing",
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

function BuyerOrdersPage() {
  const { state, currentBuyer } = useStore();
  const orders = state.buyerOrders.filter((order) => order.buyerId === currentBuyer?.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">{orders.length} orders</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(order.date).toLocaleDateString()}
                </p>
              </div>
              <Badge className={cn("border-transparent", statusClasses[order.status])}>
                {statusLabels[order.status]}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {order.items.map((item) => {
                const product = state.products.find((candidate) => candidate.id === item.productId);
                return (
                  <div
                    key={`${order.id}-${item.productId}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium">{product?.name ?? "Product"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {item.estimatedUnitPrice === undefined
                        ? "Confirm"
                        : fmtMoney(item.estimatedUnitPrice * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">
                  {order.totalEstimate > 0 ? fmtMoney(order.totalEstimate) : "Confirm"}
                </span>
              </div>
              {order.sellerNote && (
                <p className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  {order.sellerNote}
                </p>
              )}
            </div>
          </article>
        ))}

        {orders.length === 0 && (
          <div className="rounded-md border border-border bg-card p-8 text-center lg:col-span-2">
            <PackageCheck className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No orders yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
