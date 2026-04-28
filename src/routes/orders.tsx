import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, PackageCheck, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { fmtMoney, useStore } from "@/lib/store";
import type { BuyerOrder, BuyerOrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

const ALL_STATUS = "all";

const statusLabels: Record<BuyerOrderStatus, string> = {
  pending: "Pending",
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

function OrdersPage() {
  const { state, updateBuyerOrderStatus } = useStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<typeof ALL_STATUS | BuyerOrderStatus>(ALL_STATUS);

  const orders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return state.buyerOrders
      .filter((order) => status === ALL_STATUS || order.status === status)
      .filter((order) => {
        if (!query) return true;
        const buyer = state.buyerAccounts.find((account) => account.id === order.buyerId);
        const customer = state.customers.find((item) => item.id === order.customerId);
        const haystack = [
          order.orderNumber,
          buyer?.name,
          buyer?.email,
          customer?.name,
          customer?.market,
          buyer?.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return haystack.includes(query);
      });
  }, [search, state.buyerAccounts, state.buyerOrders, state.customers, status]);

  const pendingCount = state.buyerOrders.filter((order) => order.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Buyer Orders"
        description="Orders sent from the customer mobile app."
        actions={
          <div className="rounded-md bg-warning/20 px-3 py-2 text-sm font-semibold text-warning-foreground">
            {pendingCount} pending
          </div>
        }
      />

      <PageSection>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order or buyer..."
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as typeof ALL_STATUS | BuyerOrderStatus)}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="packing">Packing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={(nextStatus) => updateBuyerOrderStatus(order.id, nextStatus)}
            />
          ))}

          {orders.length === 0 && (
            <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
              No buyer orders found.
            </div>
          )}
        </div>
      </PageSection>
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
}: {
  order: BuyerOrder;
  onStatusChange: (status: BuyerOrderStatus) => void;
}) {
  const { state } = useStore();
  const buyer = state.buyerAccounts.find((account) => account.id === order.buyerId);
  const customer = state.customers.find((item) => item.id === order.customerId);
  const canConfirm = order.status === "pending";
  const canPack = order.status === "confirmed";
  const canComplete = order.status === "packing" || order.status === "confirmed";
  const canCancel = order.status !== "completed" && order.status !== "cancelled";

  return (
    <article className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{order.orderNumber}</h2>
            <Badge className={cn("border-transparent", statusClasses[order.status])}>
              {statusLabels[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {buyer?.name ?? customer?.name ?? "Buyer"} -{" "}
            {customer?.market ?? buyer?.market ?? "Market"}
          </p>
          {buyer?.location && (
            <p className="mt-1 text-xs text-muted-foreground">{buyer.location}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(order.date).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button size="sm" onClick={() => onStatusChange("confirmed")}>
              <CheckCircle2 className="h-4 w-4" />
              Confirm
            </Button>
          )}
          {canPack && (
            <Button size="sm" variant="secondary" onClick={() => onStatusChange("packing")}>
              <PackageCheck className="h-4 w-4" />
              Packing
            </Button>
          )}
          {canComplete && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange("completed")}>
              Complete
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" onClick={() => onStatusChange("cancelled")}>
              <XCircle className="h-4 w-4 text-destructive" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium text-right">Qty</th>
              <th className="py-2 pr-4 font-medium text-right">Price</th>
              <th className="py-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const product = state.products.find((candidate) => candidate.id === item.productId);
              return (
                <tr key={`${order.id}-${item.productId}`} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{product?.name ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">{product?.category}</p>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {item.estimatedUnitPrice === undefined
                      ? "Confirm"
                      : fmtMoney(item.estimatedUnitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium">
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

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">
          {order.notes ? <span>Note: {order.notes}</span> : <span>No note</span>}
        </div>
        <div className="font-bold">
          Total: {order.totalEstimate > 0 ? fmtMoney(order.totalEstimate) : "Confirm price"}
        </div>
      </div>
    </article>
  );
}
