import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { BuyerOrder, BuyerOrderStatus, PaymentStatus } from "@/lib/types";
import { primaryUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

const ALL_STATUS = "all";
const ALL_MARKETS = "all";
const ALL_PAYMENT = "all";
type OrdersView = "loading" | "control";

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

const loadableStatuses = new Set<BuyerOrderStatus>(["confirmed", "packing"]);

function OrdersPage() {
  const { state, addSale, updateBuyerOrderPayment, updateBuyerOrderStatus } = useStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<typeof ALL_STATUS | BuyerOrderStatus>(ALL_STATUS);
  const [market, setMarket] = useState(ALL_MARKETS);
  const [payment, setPayment] = useState<typeof ALL_PAYMENT | PaymentStatus>(ALL_PAYMENT);
  const [checkedLoadingItems, setCheckedLoadingItems] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<OrdersView>("control");

  const orderMarkets = useMemo(() => {
    const values = new Map<string, string>();

    for (const order of state.buyerOrders) {
      const customer = state.customers.find((item) => item.id === order.customerId);
      const buyer = state.buyerAccounts.find((account) => account.id === order.buyerId);
      values.set(order.id, customer?.market ?? buyer?.market ?? "Unknown Market");
    }

    return values;
  }, [state.buyerAccounts, state.buyerOrders, state.customers]);

  const marketOptions = useMemo(() => {
    const values = new Set<string>();

    for (const orderMarket of orderMarkets.values()) {
      if (orderMarket) values.add(orderMarket);
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [orderMarkets]);

  const orders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return state.buyerOrders
      .filter((order) => status === ALL_STATUS || order.status === status)
      .filter((order) => {
        if (market === ALL_MARKETS) return true;
        return orderMarkets.get(order.id) === market;
      })
      .filter((order) => payment === ALL_PAYMENT || order.paymentStatus === payment)
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
  }, [
    market,
    orderMarkets,
    payment,
    search,
    state.buyerAccounts,
    state.buyerOrders,
    state.customers,
    status,
  ]);

  const pendingCount = state.buyerOrders.filter((order) => order.status === "pending").length;
  const loadableOrders = useMemo(
    () => state.buyerOrders.filter((order) => loadableStatuses.has(order.status)),
    [state.buyerOrders],
  );
  const loadableCount = loadableOrders.length;
  const routeMarketSummaries = useMemo(() => {
    const summaries = new Map<
      string,
      {
        market: string;
        orderCount: number;
        productKeys: Set<string>;
      }
    >();

    for (const order of loadableOrders) {
      const orderMarket = orderMarkets.get(order.id) ?? "Unknown Market";
      const current =
        summaries.get(orderMarket) ??
        ({
          market: orderMarket,
          orderCount: 0,
          productKeys: new Set<string>(),
        } satisfies {
          market: string;
          orderCount: number;
          productKeys: Set<string>;
        });

      current.orderCount += 1;

      for (const item of order.items) {
        const product = state.products.find((candidate) => candidate.id === item.productId);
        const productName = product?.name ?? "Product";
        const unit = item.unit ?? (product ? primaryUnit(product.unit) : "បេ");
        current.productKeys.add(`${productName}__${unit}`);
      }

      summaries.set(orderMarket, current);
    }

    return Array.from(summaries.values()).sort((a, b) => a.market.localeCompare(b.market));
  }, [loadableOrders, orderMarkets, state.products]);
  const truckOrders = useMemo(
    () =>
      market === ALL_MARKETS
        ? []
        : loadableOrders.filter((order) => orderMarkets.get(order.id) === market),
    [loadableOrders, market, orderMarkets],
  );
  const loadingSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        category: string;
        key: string;
        orderIds: Set<string>;
        productName: string;
        quantity: number;
        stockQuantity: number;
        stockUnit: string;
        unit: string;
      }
    >();

    for (const order of truckOrders) {
      for (const item of order.items) {
        const product = state.products.find((candidate) => candidate.id === item.productId);
        const productName = product?.name ?? "Product";
        const unit = item.unit ?? (product ? primaryUnit(product.unit) : "បេ");
        const stockUnit = product ? primaryUnit(product.unit) : unit;
        const key = `${market}__${productName}__${unit}`;
        const current =
          summary.get(key) ??
          ({
            category: product?.category ?? "",
            key,
            orderIds: new Set<string>(),
            productName,
            quantity: 0,
            stockQuantity: 0,
            stockUnit,
            unit,
          } satisfies {
            category: string;
            key: string;
            orderIds: Set<string>;
            productName: string;
            quantity: number;
            stockQuantity: number;
            stockUnit: string;
            unit: string;
          });

        current.quantity += item.quantity;
        current.stockQuantity += item.stockQuantity;
        current.orderIds.add(order.id);
        summary.set(key, current);
      }
    }

    return Array.from(summary.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [market, state.products, truckOrders]);

  const checkedLoadingCount = loadingSummary.filter((item) => checkedLoadingItems[item.key]).length;

  const selectMarket = (nextMarket: string) => {
    setMarket(nextMarket);
    setCheckedLoadingItems({});
  };

  const toggleLoadingItem = (key: string, checked: boolean) => {
    setCheckedLoadingItems((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const clearFilters = () => {
    setSearch("");
    setStatus(ALL_STATUS);
    selectMarket(ALL_MARKETS);
    setPayment(ALL_PAYMENT);
  };

  const completeOrderAsSale = (order: BuyerOrder) => {
    if (order.items.some((item) => item.estimatedUnitPrice === undefined)) {
      toast.error("Confirm every product price before completing this order as a sale.");
      return;
    }

    if (order.status !== "packing") {
      toast.error("Pack the confirmed order before completing it as a sale.");
      return;
    }

    const paidAmount =
      order.paymentStatus === "paid"
        ? order.totalEstimate
        : order.paymentStatus === "partial"
          ? order.paidAmount
          : 0;
    const clampedPaidAmount = Number(
      Math.min(Math.max(paidAmount, 0), order.totalEstimate).toFixed(2),
    );
    const paymentStatus: PaymentStatus =
      clampedPaidAmount <= 0
        ? "unpaid"
        : clampedPaidAmount >= order.totalEstimate
          ? "paid"
          : "partial";
    const sale = addSale({
      customerId: order.customerId,
      date: new Date().toISOString().slice(0, 10),
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.estimatedUnitPrice ?? 0,
      })),
      paidAmount: clampedPaidAmount,
      paymentStatus,
      notes: [order.orderNumber, order.notes].filter(Boolean).join(" - "),
    });

    if ("error" in sale) {
      toast.error(sale.error);
      return;
    }

    updateBuyerOrderStatus(order.id, "completed", `Converted to ${sale.receiptNumber}`);
    toast.success(`${sale.receiptNumber} created from ${order.orderNumber}.`);
  };

  return (
    <div>
      <PageHeader
        title="Buyer Orders"
        description="Orders sent from the customer mobile app."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-md border border-border bg-background p-1">
              <Button
                type="button"
                size="sm"
                variant={view === "loading" ? "default" : "ghost"}
                onClick={() => setView("loading")}
              >
                Truck Loading Summary ({loadableCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "control" ? "default" : "ghost"}
                onClick={() => setView("control")}
              >
                Order Control ({pendingCount})
              </Button>
            </div>
            <div className="rounded-md bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
              {loadableCount} to load
            </div>
            <div className="rounded-md bg-warning/20 px-3 py-2 text-sm font-semibold text-warning-foreground">
              {pendingCount} pending
            </div>
          </div>
        }
      />

      {view === "loading" && (
        <PageSection
          title="Truck Loading Summary"
          description={
            market === ALL_MARKETS
              ? "Only confirmed and packing orders appear here. Choose one market route."
              : `Combined active orders for ${market}.`
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <span className="rounded-md bg-primary/15 px-3 py-2 font-semibold text-primary">
                {market === ALL_MARKETS ? "Select market" : `${truckOrders.length} to load`}
              </span>
              <span className="rounded-md bg-muted px-3 py-2 font-semibold text-muted-foreground">
                {loadingSummary.length} products
              </span>
              {loadingSummary.length > 0 && (
                <span className="rounded-md bg-success/15 px-3 py-2 font-semibold text-success">
                  {checkedLoadingCount}/{loadingSummary.length} checked
                </span>
              )}
              {checkedLoadingCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCheckedLoadingItems({})}
                >
                  Reset
                </Button>
              )}
            </div>
          }
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="mb-2 text-sm font-semibold">Delivery market</p>
              <Select value={market} onValueChange={selectMarket}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MARKETS}>Choose market route</SelectItem>
                  {marketOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                The truck checklist combines one market only.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {routeMarketSummaries.map((summary) => (
                <button
                  key={summary.market}
                  type="button"
                  onClick={() => selectMarket(summary.market)}
                  className={cn(
                    "rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50",
                    market === summary.market && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{summary.market}</span>
                    <Badge className="border-transparent bg-muted text-muted-foreground">
                      {summary.productKeys.size} products
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.orderCount} confirmed order(s)
                  </p>
                </button>
              ))}
            </div>
          </div>

          {market === ALL_MARKETS ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Confirm customer orders first, then select one delivery market before loading the
              truck.
            </div>
          ) : loadingSummary.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="hidden grid-cols-[44px_minmax(0,1fr)_140px_110px_140px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
                <span>Done</span>
                <span>Product</span>
                <span className="text-right">Load Qty</span>
                <span className="text-right">Orders</span>
                <span className="text-right">Stock Use</span>
              </div>
              <div className="divide-y divide-border">
                {loadingSummary.map((item, index) => {
                  const checked = Boolean(checkedLoadingItems[item.key]);
                  const checkboxId = `loading-item-${index}`;

                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 transition-colors md:grid-cols-[44px_minmax(0,1fr)_140px_110px_140px] md:items-center",
                        checked && "bg-success/5",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        onCheckedChange={(value) => toggleLoadingItem(item.key, value === true)}
                        aria-label={`Mark ${item.productName} as loaded`}
                        className="mt-1 h-5 w-5 rounded-md border-border md:mt-0"
                      />
                      <label htmlFor={checkboxId} className="min-w-0 cursor-pointer">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "truncate font-semibold",
                              checked && "text-muted-foreground line-through decoration-2",
                            )}
                          >
                            {item.productName}
                          </p>
                          {checked && (
                            <Badge className="border-transparent bg-success/15 text-success">
                              Loaded
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.category || "No category"}
                        </p>
                      </label>

                      <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:block md:text-right">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Load Qty
                        </span>
                        <span className="text-xl font-bold">
                          {item.quantity} {item.unit}
                        </span>
                      </div>

                      <div className="col-start-2 flex items-center justify-between gap-3 text-sm text-muted-foreground md:col-start-auto md:block md:text-right">
                        <span className="text-xs font-semibold uppercase md:hidden">Orders</span>
                        <span>{item.orderIds.size} order(s)</span>
                      </div>

                      <div className="col-start-2 flex items-center justify-between gap-3 text-sm text-muted-foreground md:col-start-auto md:block md:text-right">
                        <span className="text-xs font-semibold uppercase md:hidden">Stock Use</span>
                        <span>
                          {item.stockUnit !== item.unit
                            ? `${Number(item.stockQuantity.toFixed(2))} ${item.stockUnit}`
                            : "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No confirmed products to load for {market}.
            </div>
          )}
        </PageSection>
      )}

      {view === "control" && (
        <PageSection
          title="Order Control"
          description="Filter, confirm, pack, and complete orders."
        >
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order or buyer..."
                className="pl-9"
              />
            </div>
            <Select value={market} onValueChange={selectMarket}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MARKETS}>All markets</SelectItem>
                {marketOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as typeof ALL_STATUS | BuyerOrderStatus)}
            >
              <SelectTrigger>
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
            <Select
              value={payment}
              onValueChange={(value) => setPayment(value as typeof ALL_PAYMENT | PaymentStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PAYMENT}>All payment</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCompleteSale={completeOrderAsSale}
                onPaymentChange={(nextStatus, paidAmount) =>
                  updateBuyerOrderPayment(order.id, nextStatus, paidAmount)
                }
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
      )}
    </div>
  );
}

function OrderCard({
  order,
  onCompleteSale,
  onPaymentChange,
  onStatusChange,
}: {
  order: BuyerOrder;
  onCompleteSale: (order: BuyerOrder) => void;
  onPaymentChange: (status: PaymentStatus, paidAmount?: number) => void;
  onStatusChange: (status: BuyerOrderStatus) => void;
}) {
  const { state } = useStore();
  const buyer = state.buyerAccounts.find((account) => account.id === order.buyerId);
  const customer = state.customers.find((item) => item.id === order.customerId);
  const canConfirm = order.status === "pending";
  const canPack = order.status === "confirmed";
  const canComplete = order.status === "packing";
  const canCancel = order.status !== "completed" && order.status !== "cancelled";
  const remaining = Math.max(order.totalEstimate - order.paidAmount, 0);

  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{order.orderNumber}</h2>
            <Badge className={cn("border-transparent", statusClasses[order.status])}>
              {statusLabels[order.status]}
            </Badge>
            <Badge className={cn("border-transparent", paymentClasses[order.paymentStatus])}>
              {paymentLabels[order.paymentStatus]}
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
          <p className="mt-2 text-xs text-muted-foreground">
            {order.status === "pending"
              ? "Waiting for seller confirmation. Not included in truck loading yet."
              : loadableStatuses.has(order.status)
                ? "Confirmed for loading route."
                : "Closed order."}
          </p>
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <div className="flex flex-wrap gap-2">
            <Select
              value={order.paymentStatus}
              onValueChange={(value) => onPaymentChange(value as PaymentStatus, order.paidAmount)}
            >
              <SelectTrigger className="h-9 w-32">
                <WalletCards className="h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            {order.paymentStatus === "partial" && (
              <Input
                type="number"
                min={0}
                max={order.totalEstimate}
                step="0.01"
                value={order.paidAmount}
                onChange={(event) => onPaymentChange("partial", Number(event.target.value))}
                className="h-9 w-28 text-right"
                aria-label="Paid amount"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {canConfirm && (
              <Button size="sm" onClick={() => onStatusChange("confirmed")}>
                <CheckCircle2 className="h-4 w-4" />
                Confirm
              </Button>
            )}
            {canPack && (
              <Button size="sm" variant="secondary" onClick={() => onStatusChange("packing")}>
                <PackageCheck className="h-4 w-4" />
                Pack
              </Button>
            )}
            {canComplete && (
              <Button size="sm" variant="outline" onClick={() => onCompleteSale(order)}>
                <ClipboardList className="h-4 w-4" />
                Complete sale
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
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Price</th>
              <th className="px-3 py-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const product = state.products.find((candidate) => candidate.id === item.productId);
              return (
                <tr key={`${order.id}-${item.productId}`} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium">{product?.name ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">{product?.category}</p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.estimatedUnitPrice === undefined
                      ? "Confirm"
                      : fmtMoney(item.estimatedUnitPrice)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
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

      <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">
          {order.notes ? <span>Note: {order.notes}</span> : <span>No note</span>}
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-semibold">
          <span>Total: {order.totalEstimate > 0 ? fmtMoney(order.totalEstimate) : "Confirm"}</span>
          <span>Paid: {fmtMoney(order.paidAmount)}</span>
          <span className={remaining > 0 ? "text-destructive" : "text-success"}>
            Remaining: {fmtMoney(remaining)}
          </span>
        </div>
      </div>
      {order.sellerNote && (
        <p className="mt-2 text-xs text-muted-foreground">Seller note: {order.sellerNote}</p>
      )}
    </article>
  );
}
