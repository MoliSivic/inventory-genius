import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Search,
  Wallet,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { fmtMoney, getBuyerOrderDisplayTotals, useStore } from "@/lib/store";
import type { BuyerOrder, BuyerOrderStatus, PaymentStatus } from "@/lib/types";
import { primaryUnit } from "@/lib/units";
import { cn, displayZeroAsPlaceholder, parseNumericInput } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

const ALL_MARKETS = "all";
type OrdersView = "loading" | "control";
type WeekWindow = "1" | "2" | "3" | "all";

const weekWindowLabels: Record<WeekWindow, string> = {
  "1": "Last 1 week",
  "2": "Last 2 weeks",
  "3": "Last 3 weeks",
  all: "All active orders",
};

const statusLabels: Record<BuyerOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packing: "Packing/Loading",
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

const routeStatuses = new Set<BuyerOrderStatus>(["pending", "confirmed", "packing"]);

function isInsideWeekWindow(date: string, window: WeekWindow) {
  if (window === "all") return true;

  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(window) * 7);

  return timestamp >= start.getTime();
}

function OrdersPage() {
  const { state, addSale, updateBuyerOrderPayment, updateBuyerOrderStatus } = useStore();
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState(ALL_MARKETS);
  const [weekWindow, setWeekWindow] = useState<WeekWindow>("1");
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
      .filter((order) => {
        if (market === ALL_MARKETS) return true;
        return orderMarkets.get(order.id) === market;
      })
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
  }, [market, orderMarkets, search, state.buyerAccounts, state.buyerOrders, state.customers]);

  const pendingCount = state.buyerOrders.filter((order) => order.status === "pending").length;
  const orderControlCount = state.buyerOrders.filter(
    (order) => !order.saleId && routeStatuses.has(order.status),
  ).length;
  const activeControlOrders = useMemo(
    () => orders.filter((order) => !order.saleId && routeStatuses.has(order.status)),
    [orders],
  );
  const completedReceiptOrders = useMemo(
    () => orders.filter((order) => order.saleId && order.status === "completed"),
    [orders],
  );
  const loadableOrders = useMemo(
    () =>
      state.buyerOrders.filter(
        (order) =>
          routeStatuses.has(order.status) &&
          !order.saleId &&
          isInsideWeekWindow(order.date, weekWindow),
      ),
    [state.buyerOrders, weekWindow],
  );
  const loadableCount = loadableOrders.length;
  const routeMarketSummaries = useMemo(() => {
    const summaries = new Map<
      string,
      {
        confirmedCount: number;
        market: string;
        orderCount: number;
        packingCount: number;
        pendingCount: number;
        productKeys: Set<string>;
        totalValue: number;
      }
    >();

    for (const order of loadableOrders) {
      const orderMarket = orderMarkets.get(order.id) ?? "Unknown Market";
      const current =
        summaries.get(orderMarket) ??
        ({
          market: orderMarket,
          orderCount: 0,
          pendingCount: 0,
          confirmedCount: 0,
          packingCount: 0,
          productKeys: new Set<string>(),
          totalValue: 0,
        } satisfies {
          confirmedCount: number;
          market: string;
          orderCount: number;
          packingCount: number;
          pendingCount: number;
          productKeys: Set<string>;
          totalValue: number;
        });

      current.orderCount += 1;
      current.totalValue += order.totalEstimate;

      if (order.status === "pending") current.pendingCount += 1;
      if (order.status === "confirmed") current.confirmedCount += 1;
      if (order.status === "packing") current.packingCount += 1;

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
        routeValue: number;
        stockQuantity: number;
        stockAvailable: number;
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
            routeValue: 0,
            stockQuantity: 0,
            stockAvailable: product?.stock ?? 0,
            stockUnit,
            unit,
          } satisfies {
            category: string;
            key: string;
            orderIds: Set<string>;
            productName: string;
            quantity: number;
            routeValue: number;
            stockQuantity: number;
            stockAvailable: number;
            stockUnit: string;
            unit: string;
          });

        current.quantity += item.quantity;
        current.routeValue += (item.estimatedUnitPrice ?? 0) * item.quantity;
        current.stockQuantity += item.stockQuantity;
        current.orderIds.add(order.id);
        summary.set(key, current);
      }
    }

    return Array.from(summary.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [market, state.products, truckOrders]);

  const checkedLoadingCount = loadingSummary.filter((item) => checkedLoadingItems[item.key]).length;
  const allLoadingChecked =
    loadingSummary.length > 0 && checkedLoadingCount === loadingSummary.length;
  const uncheckedLoadingCount = Math.max(loadingSummary.length - checkedLoadingCount, 0);
  const routeTotal = truckOrders.reduce((total, order) => total + order.totalEstimate, 0);
  const routeOrderCounts = truckOrders.reduce(
    (counts, order) => ({
      pending: counts.pending + (order.status === "pending" ? 1 : 0),
      confirmed: counts.confirmed + (order.status === "confirmed" ? 1 : 0),
      packing: counts.packing + (order.status === "packing" ? 1 : 0),
    }),
    { pending: 0, confirmed: 0, packing: 0 },
  );

  const selectMarket = (nextMarket: string) => {
    setMarket(nextMarket);
    setCheckedLoadingItems({});
  };

  const selectWeekWindow = (nextWindow: WeekWindow) => {
    setWeekWindow(nextWindow);
    setCheckedLoadingItems({});
  };

  const toggleLoadingItem = (key: string, checked: boolean) => {
    setCheckedLoadingItems((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const setAllLoadingItems = (checked: boolean) => {
    if (!checked) {
      setCheckedLoadingItems({});
      return;
    }

    setCheckedLoadingItems(
      Object.fromEntries(loadingSummary.map((item) => [item.key, true])) as Record<string, boolean>,
    );
  };

  const completeTruckLoading = () => {
    if (market === ALL_MARKETS || truckOrders.length === 0) {
      toast.error("Choose one market route before loading the truck.");
      return;
    }

    if (!allLoadingChecked) {
      toast.error("Check every product in the truck loading list first.");
      return;
    }

    const ordersToLoad = truckOrders.filter((order) => routeStatuses.has(order.status));
    if (ordersToLoad.length === 0) {
      toast.error("No active orders to load for this market.");
      return;
    }

    const orderWithoutPrice = ordersToLoad.find((order) =>
      order.items.some((item) => item.estimatedUnitPrice === undefined),
    );
    if (orderWithoutPrice) {
      toast.error(`Confirm every product price before loading ${orderWithoutPrice.orderNumber}.`);
      return;
    }

    const stockByProduct = new Map<string, number>();
    for (const order of ordersToLoad) {
      for (const item of order.items) {
        stockByProduct.set(
          item.productId,
          (stockByProduct.get(item.productId) ?? 0) + item.stockQuantity,
        );
      }
    }

    for (const [productId, quantity] of stockByProduct.entries()) {
      const product = state.products.find((item) => item.id === productId);
      if (!product) {
        toast.error("Product not found.");
        return;
      }

      if (quantity > product.stock) {
        toast.error(
          `Not enough stock for ${product.name} (need ${quantity}, have ${product.stock}).`,
        );
        return;
      }
    }

    let createdCount = 0;
    for (const order of ordersToLoad) {
      const sale = addSale({
        customerId: order.customerId,
        date: new Date().toISOString().slice(0, 10),
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.estimatedUnitPrice ?? 0,
        })),
        paidAmount: 0,
        paymentStatus: "unpaid",
        notes: [order.orderNumber, `Loaded to ${market} truck`, order.notes]
          .filter(Boolean)
          .join(" - "),
      });

      if ("error" in sale) {
        toast.error(sale.error);
        return;
      }

      updateBuyerOrderStatus(
        order.id,
        "completed",
        `Loaded to ${market} truck. Receipt ${sale.receiptNumber} created.`,
        sale.id,
      );
      createdCount += 1;
    }

    setCheckedLoadingItems({});
    toast.success(
      `${createdCount} receipt${createdCount === 1 ? "" : "s"} created for ${market}. Payment can be updated after delivery.`,
    );
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

    const sale = addSale({
      customerId: order.customerId,
      date: new Date().toISOString().slice(0, 10),
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.estimatedUnitPrice ?? 0,
      })),
      paidAmount: 0,
      paymentStatus: "unpaid",
      notes: [order.orderNumber, order.notes].filter(Boolean).join(" - "),
    });

    if ("error" in sale) {
      toast.error(sale.error);
      return;
    }

    updateBuyerOrderStatus(
      order.id,
      "completed",
      `Loaded manually. Receipt ${sale.receiptNumber} created.`,
      sale.id,
    );
    toast.success(`${sale.receiptNumber} created from ${order.orderNumber}.`);
  };

  return (
    <div>
      <PageHeader
        title="Buyer Orders"
        description="Orders sent from the customer mobile app."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant={view === "loading" ? "default" : "outline"}
              className="h-10 px-4"
              onClick={() => setView("loading")}
            >
              Truck Loading Summary ({loadableCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "control" ? "default" : "outline"}
              className="h-10 px-4"
              onClick={() => setView("control")}
            >
              Order Control ({orderControlCount})
            </Button>
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
              ? `Active customer orders from ${weekWindowLabels[weekWindow].toLowerCase()}. Choose one market route.`
              : `Combined ${weekWindowLabels[weekWindow].toLowerCase()} orders for ${market}.`
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              {loadingSummary.length > 0 && !allLoadingChecked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllLoadingItems(true)}
                >
                  Mark all loaded
                </Button>
              )}
              {checkedLoadingCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllLoadingItems(false)}
                >
                  Reset
                </Button>
              )}
              {loadingSummary.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  disabled={!allLoadingChecked}
                  onClick={completeTruckLoading}
                >
                  Confirm loaded & create receipts
                </Button>
              )}
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[240px_280px_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Order window</p>
              <Select
                value={weekWindow}
                onValueChange={(value) => selectWeekWindow(value as WeekWindow)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 1 week</SelectItem>
                  <SelectItem value="2">Last 2 weeks</SelectItem>
                  <SelectItem value="3">Last 3 weeks</SelectItem>
                  <SelectItem value="all">All active orders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Delivery market</p>
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
            </div>

            <div className="grid grid-cols-1 gap-2 md:col-span-2 xl:col-span-1 xl:grid-cols-2">
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{summary.orderCount} orders</span>
                    <span>{fmtMoney(summary.totalValue)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {summary.pendingCount > 0 && (
                      <Badge className="border-transparent bg-warning/20 text-warning-foreground">
                        {summary.pendingCount} pending
                      </Badge>
                    )}
                    {summary.confirmedCount > 0 && (
                      <Badge className="border-transparent bg-primary/15 text-primary">
                        {summary.confirmedCount} confirmed
                      </Badge>
                    )}
                    {summary.packingCount > 0 && (
                      <Badge className="border-transparent bg-secondary text-secondary-foreground">
                        {summary.packingCount} packing
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {market !== ALL_MARKETS && (
            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <RouteStat
                label="Route orders"
                value={truckOrders.length}
                detail={`${routeOrderCounts.pending} pending`}
              />
              <RouteStat
                label="Products"
                value={loadingSummary.length}
                detail={`${uncheckedLoadingCount} left`}
              />
              <RouteStat
                label="Loaded"
                value={`${checkedLoadingCount}/${loadingSummary.length}`}
                detail={allLoadingChecked ? "Ready" : "Checking"}
                tone={allLoadingChecked ? "success" : "default"}
              />
              <RouteStat label="Route total" value={fmtMoney(routeTotal)} detail="Unpaid invoice" />
            </div>
          )}

          {market === ALL_MARKETS ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Select one delivery market to review active customer orders for this time range.
            </div>
          ) : loadingSummary.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="hidden grid-cols-[44px_minmax(0,1fr)_140px_130px_100px_130px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
                <span>Done</span>
                <span>Product</span>
                <span className="text-right">Stock</span>
                <span className="text-right">Load Qty</span>
                <span className="text-right">Orders</span>
                <span className="text-right">Value</span>
              </div>
              <div className="divide-y divide-border">
                {loadingSummary.map((item, index) => {
                  const checked = Boolean(checkedLoadingItems[item.key]);
                  const checkboxId = `loading-item-${index}`;

                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 transition-colors md:grid-cols-[44px_minmax(0,1fr)_140px_130px_100px_130px] md:items-center",
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

                      <div className="col-start-2 flex items-center justify-between gap-3 text-sm md:col-start-auto md:block md:text-right">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Stock
                        </span>
                        <div>
                          <p className="font-semibold">
                            {Number(item.stockAvailable.toFixed(2))} {item.stockUnit}
                          </p>
                          {item.stockUnit !== item.unit && (
                            <p className="text-xs text-muted-foreground">
                              uses {Number(item.stockQuantity.toFixed(2))} {item.stockUnit}
                            </p>
                          )}
                        </div>
                      </div>

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

                      <div className="col-start-2 flex items-center justify-between gap-3 text-sm md:col-start-auto md:block md:text-right">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">
                          Value
                        </span>
                        <span className="font-semibold">{fmtMoney(item.routeValue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No active products to load for {market} in this time range.
            </div>
          )}

          {market !== ALL_MARKETS && truckOrders.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-border bg-background">
              <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Orders in this route</h3>
                  <p className="text-xs text-muted-foreground">
                    {truckOrders.length} order(s) from {market} in {weekWindowLabels[weekWindow]}.
                  </p>
                </div>
                <p className="text-sm font-semibold">{fmtMoney(routeTotal)}</p>
              </div>
              <div className="divide-y divide-border">
                {truckOrders.map((order) => {
                  const buyer = state.buyerAccounts.find((item) => item.id === order.buyerId);
                  const customer = state.customers.find((item) => item.id === order.customerId);

                  return (
                    <div
                      key={order.id}
                      className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_140px] md:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{order.orderNumber}</span>
                          <Badge className={cn("border-transparent", statusClasses[order.status])}>
                            {statusLabels[order.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {buyer?.name ?? customer?.name ?? "Buyer"} -{" "}
                          {customer?.market ?? buyer?.market ?? market}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {order.items.map((item, index) => {
                            const product = state.products.find(
                              (candidate) => candidate.id === item.productId,
                            );

                            return (
                              <div
                                key={`${order.id}-${item.productId}-${index}`}
                                className="rounded-md border border-border bg-muted/30 px-3 py-2"
                              >
                                <p className="truncate text-sm font-semibold">
                                  {product?.name ?? "Product"}
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                  <span>
                                    {item.quantity} {item.unit}
                                  </span>
                                  <span>
                                    {item.estimatedUnitPrice === undefined
                                      ? "Confirm"
                                      : fmtMoney(item.estimatedUnitPrice * item.quantity)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-sm font-semibold md:text-right">
                        <p>{fmtMoney(order.totalEstimate)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.items.length} item(s)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PageSection>
      )}

      {view === "control" && (
        <PageSection
          title="Order Control"
          description="Filter, confirm, pack, and complete orders."
        >
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
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
          </div>

          <div className="space-y-3">
            {activeControlOrders.map((order) => (
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

            {activeControlOrders.length === 0 && (
              <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
                No active buyer orders need confirmation or loading.
              </div>
            )}

            {completedReceiptOrders.length > 0 && (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Completed receipts</h3>
                    <p className="text-xs text-muted-foreground">
                      Receipt-backed orders. Record physical cash after delivery here.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {completedReceiptOrders.length} completed
                  </span>
                </div>
                <div className="space-y-3">
                  {completedReceiptOrders.map((order) => (
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
                </div>
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
  const { state, recordPayment } = useStore();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [partialEditorOpen, setPartialEditorOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState(0);
  const buyer = state.buyerAccounts.find((account) => account.id === order.buyerId);
  const customer = state.customers.find((item) => item.id === order.customerId);
  const { receipt, total, paidAmount, remaining, paymentStatus } = getBuyerOrderDisplayTotals(
    state,
    order,
  );
  const hasReceipt = Boolean(receipt);
  const paymentSelectValue = partialEditorOpen ? "partial" : paymentStatus;
  const canConfirm = order.status === "pending";
  const canPack = order.status === "confirmed";
  const canComplete = order.status === "packing";
  const canCancel = order.status !== "completed" && order.status !== "cancelled";
  const canRecordPayment = order.status === "completed" && hasReceipt && remaining > 0;

  const openPaymentDialog = () => {
    setPaymentAmount(Number(remaining.toFixed(2)));
    setPaymentDialogOpen(true);
  };

  const savePayment = () => {
    if (!receipt) {
      toast.error("Receipt not found for this order.");
      return;
    }

    const normalizedAmount = Number(Math.min(Math.max(paymentAmount, 0), remaining).toFixed(2));
    if (normalizedAmount <= 0) {
      toast.error("Enter the cash amount received.");
      return;
    }

    recordPayment({
      customerId: receipt.customerId,
      saleId: receipt.id,
      amount: normalizedAmount,
      date: new Date().toISOString().slice(0, 10),
      note: `Physical payment for ${receipt.receiptNumber}`,
    });

    toast.success(`Payment recorded for ${receipt.receiptNumber}.`);
    setPaymentDialogOpen(false);
    setPaymentAmount(0);
  };

  const updatePartialAmount = (value: number) => {
    const normalizedAmount = Number(Math.min(Math.max(value, 0), total).toFixed(2));
    setPartialAmount(normalizedAmount);
    onPaymentChange("partial", normalizedAmount);

    if (normalizedAmount >= total && total > 0) {
      setPartialEditorOpen(false);
    }
  };

  const handlePaymentSelect = (value: PaymentStatus) => {
    if (value === "partial") {
      const startingAmount = paidAmount > 0 && paidAmount < total ? paidAmount : 0;
      setPartialAmount(startingAmount);
      setPartialEditorOpen(true);
      if (startingAmount > 0) {
        onPaymentChange("partial", startingAmount);
      }
      return;
    }

    setPartialEditorOpen(false);
    setPartialAmount(0);
    onPaymentChange(value, value === "paid" ? total : 0);
  };

  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{order.orderNumber}</h2>
            <Badge className={cn("border-transparent", statusClasses[order.status])}>
              {statusLabels[order.status]}
            </Badge>
            {hasReceipt ? (
              <Badge className={cn("border-transparent", paymentClasses[paymentStatus])}>
                {paymentLabels[paymentStatus]}
              </Badge>
            ) : (
              <Badge className="border-transparent bg-muted text-muted-foreground">
                Payment after receipt
              </Badge>
            )}
          </div>
          {receipt && (
            <p className="mt-1 text-xs font-medium text-primary">
              Receipt: {receipt.receiptNumber}
            </p>
          )}
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
              ? "Waiting for loading confirmation. It can be included in a market truck route."
              : routeStatuses.has(order.status)
                ? "Active for loading route."
                : hasReceipt
                  ? "Receipt created. Record physical payment after delivery."
                  : "Closed order."}
          </p>
        </div>

        <div className="flex flex-col gap-2 xl:items-end">
          <div className="flex flex-wrap gap-2">
            {canRecordPayment && (
              <Button type="button" size="sm" onClick={openPaymentDialog}>
                <Wallet className="h-4 w-4" />
                Record Payment
              </Button>
            )}
            {hasReceipt ? (
              <>
                <Select
                  value={paymentSelectValue}
                  onValueChange={(value) => handlePaymentSelect(value as PaymentStatus)}
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
                {(partialEditorOpen || paymentStatus === "partial") && (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2">
                    <Label
                      htmlFor={`partial-paid-${order.id}`}
                      className="whitespace-nowrap text-xs font-semibold text-primary"
                    >
                      Paid
                    </Label>
                    <Input
                      id={`partial-paid-${order.id}`}
                      type="number"
                      min={0}
                      max={total}
                      step="0.01"
                      value={displayZeroAsPlaceholder(
                        partialEditorOpen ? partialAmount : paidAmount,
                      )}
                      placeholder="0"
                      onChange={(event) =>
                        updatePartialAmount(parseNumericInput(event.target.value))
                      }
                      className="h-7 w-24 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0"
                      aria-label="Paid amount"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                Create receipt before payment
              </div>
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
          <span>Total: {total > 0 ? fmtMoney(total) : "Confirm"}</span>
          <span>Paid: {fmtMoney(paidAmount)}</span>
          <span className={remaining > 0 ? "text-destructive" : "text-success"}>
            Remaining: {fmtMoney(remaining)}
          </span>
        </div>
      </div>
      {order.sellerNote && (
        <p className="mt-2 text-xs text-muted-foreground">Seller note: {order.sellerNote}</p>
      )}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (open) setPaymentAmount(Number(remaining.toFixed(2)));
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter the cash received after delivery. The linked receipt and customer invoice will
              update together.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Receipt</span>
              <span className="font-semibold">{receipt?.receiptNumber ?? order.orderNumber}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{fmtMoney(total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Already paid</span>
              <span className="font-semibold">{fmtMoney(paidAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-semibold text-destructive">{fmtMoney(remaining)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`payment-${order.id}`}>Cash received</Label>
            <div className="flex gap-2">
              <Input
                id={`payment-${order.id}`}
                type="number"
                min={0}
                max={remaining}
                step="0.01"
                value={displayZeroAsPlaceholder(paymentAmount)}
                placeholder="0"
                onChange={(event) => setPaymentAmount(parseNumericInput(event.target.value))}
              />
              <Button type="button" variant="outline" onClick={() => setPaymentAmount(remaining)}>
                Full
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={savePayment}>
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function RouteStat({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background p-3",
        tone === "success" && "border-success/30 bg-success/5",
      )}
    >
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-bold">{value}</p>
      <p
        className={cn(
          "mt-1 text-xs text-muted-foreground",
          tone === "success" && "font-medium text-success",
        )}
      >
        {detail}
      </p>
    </div>
  );
}
