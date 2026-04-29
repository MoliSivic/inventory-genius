import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Minus,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { buyerVisiblePrice, fmtMoney, formatUnits, useStore } from "@/lib/store";
import {
  getMaxSaleQuantityFromStock,
  getProductSaleUnitOptions,
  normalizeSaleQuantityFromStock,
} from "@/lib/sale-units";
import type { Product, UnitType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer/shop")({
  component: BuyerShopPage,
});

type CartItem = {
  productId: string;
  quantity: number;
  unit?: UnitType;
};

const ALL_CATEGORY = "all";
const priceSourceLabels = {
  customer: "Your price",
  market: "Market price",
  estimate: "Estimate",
} as const;

function BuyerShopPage() {
  const { state, currentBuyer, addBuyerOrder } = useStore();
  const navigate = Route.useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [notes, setNotes] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(state.products.map((product) => product.category))).filter(Boolean),
    [state.products],
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return state.products
      .filter((product) => product.stock > 0)
      .filter((product) => category === ALL_CATEGORY || product.category === category)
      .filter((product) => !query || product.name.toLocaleLowerCase().includes(query))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [category, search, state.products]);

  const cartItems = useMemo(
    () =>
      Object.values(cart)
        .filter((item) => item.quantity > 0)
        .map((item) => {
          const product = state.products.find((candidate) => candidate.id === item.productId);
          return product ? { ...item, product } : null;
        })
        .filter((item): item is CartItem & { product: Product } => item !== null),
    [cart, state.products],
  );

  const selectedCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of cartItems) {
      counts.set(item.product.category, (counts.get(item.product.category) ?? 0) + 1);
    }

    return counts;
  }, [cartItems]);

  const cartTotal = cartItems.reduce((sum, item) => {
    if (!currentBuyer) return sum;
    const price = buyerVisiblePrice(state, currentBuyer.customerId, item.productId, item.unit);
    return price === undefined ? sum : sum + price.price * item.quantity;
  }, 0);

  const pricedItemCount = cartItems.filter(
    (item) =>
      currentBuyer &&
      buyerVisiblePrice(state, currentBuyer.customerId, item.productId, item.unit) !== undefined,
  ).length;
  const customerInvoices = state.sales.filter(
    (sale) => sale.customerId === currentBuyer?.customerId,
  );
  const openOrderCount = state.buyerOrders.filter(
    (order) =>
      order.buyerId === currentBuyer?.id &&
      order.status !== "completed" &&
      order.status !== "cancelled",
  ).length;
  const totalDebt = customerInvoices.reduce(
    (sum, sale) => sum + Math.max(sale.total - sale.paidAmount, 0),
    0,
  );

  const setCartQuantity = (product: Product, unit: UnitType, quantity: number) => {
    const nextQuantity = normalizeSaleQuantityFromStock(product, quantity, product.stock, unit);
    setCart((current) => {
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }

      return {
        ...current,
        [product.id]: {
          productId: product.id,
          unit,
          quantity: nextQuantity,
        },
      };
    });
  };

  const handleUnitChange = (product: Product, unit: UnitType) => {
    const currentQuantity = cart[product.id]?.quantity ?? 0;
    setCartQuantity(product, unit, currentQuantity);
  };

  const placeOrder = () => {
    if (!currentBuyer) return;

    if (!currentBuyer.market.trim()) {
      toast.error("Choose your market in Settings before ordering.");
      void navigate({ to: "/buyer/settings" });
      return;
    }

    const result = addBuyerOrder({
      buyerId: currentBuyer.id,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
      })),
      notes,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setCart({});
    setNotes("");
    setReviewOpen(false);
    toast.success(`Order sent: ${result.orderNumber}`);
    void navigate({ to: "/buyer/orders" });
  };

  if (currentBuyer && !currentBuyer.market.trim()) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <section className="rounded-md border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Settings className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Choose your market first</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The seller delivers one market route at a time. Set your market in Settings so your
            order goes to the correct truck route.
          </p>
          <Button
            className="mt-5 w-full sm:w-auto"
            onClick={() => void navigate({ to: "/buyer/settings" })}
          >
            Open Settings
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">{currentBuyer?.market}</p>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 sm:hidden">
        <MobileStat label="Open" value={`${openOrderCount}`} icon={PackageCheck} />
        <MobileStat label="Invoices" value={`${customerInvoices.length}`} icon={ReceiptText} />
        <MobileStat
          label="Debt"
          value={fmtMoney(totalDebt)}
          icon={WalletCards}
          danger={totalDebt > 0}
        />
      </div>

      <div className="sticky top-14 z-10 -mx-3 mb-3 space-y-3 border-b border-border bg-background px-3 pb-3 pt-1 sm:-mx-6 sm:top-16 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product"
            className="h-12 rounded-md pl-10 text-base"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            type="button"
            size="sm"
            variant={category === ALL_CATEGORY ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setCategory(ALL_CATEGORY)}
          >
            All
            {cartItems.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {cartItems.length}
              </span>
            )}
          </Button>
          {categories.map((item) => {
            const selectedCount = selectedCategoryCounts.get(item) ?? 0;
            return (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={selectedCount > 0 ? "outline" : category === item ? "default" : "outline"}
                className={cn(
                  "rounded-full",
                  selectedCount > 0 &&
                    "border-success bg-success/15 text-success hover:bg-success/20 hover:text-success",
                )}
                onClick={() => setCategory(item)}
              >
                {item}
                {selectedCount > 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 text-[10px]",
                      "bg-success text-success-foreground",
                    )}
                  >
                    {selectedCount}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        <div className="rounded-md border border-border bg-card p-3 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{cartItems.length} products selected</p>
              <p className="truncate text-muted-foreground">
                {cartItems.length === 0
                  ? fmtMoney(0)
                  : cartTotal > 0
                    ? fmtMoney(cartTotal)
                    : "Seller will confirm price"}
              </p>
            </div>
            <Button
              className="h-11 w-full text-base min-[420px]:w-auto min-[420px]:px-5"
              onClick={() => setReviewOpen(true)}
              disabled={cartItems.length === 0}
            >
              <ShoppingCart className="h-5 w-5" />
              Review Order
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.map((product) => {
          const unitOptions = getProductSaleUnitOptions(product);
          const selectedUnit = cart[product.id]?.unit ?? unitOptions[0]?.unit;
          const quantity = cart[product.id]?.quantity ?? 0;
          const maxQuantity = getMaxSaleQuantityFromStock(product, product.stock, selectedUnit);
          const price =
            currentBuyer && selectedUnit
              ? buyerVisiblePrice(state, currentBuyer.customerId, product.id, selectedUnit)
              : undefined;
          const lineTotal = price ? price.price * quantity : undefined;

          return (
            <article
              key={product.id}
              className={cn(
                "flex min-w-0 flex-col rounded-md border bg-card p-2.5 shadow-[var(--shadow-card)] transition-colors",
                quantity > 0 ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="flex flex-1 gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/10 text-sidebar-primary">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-sm font-semibold leading-tight">
                        {product.name}
                      </h2>
                      <p
                        className={cn(
                          "truncate text-xs text-muted-foreground",
                          quantity > 0 && "font-medium text-primary",
                        )}
                      >
                        {product.category}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold">
                        {lineTotal !== undefined && quantity > 0
                          ? fmtMoney(lineTotal)
                          : price === undefined
                            ? "Confirm"
                            : fmtMoney(price.price)}
                      </p>
                      {price && quantity > 0 && (
                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                          {quantity} x {fmtMoney(price.price)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-success/15 px-2 py-0.5 font-medium text-success">
                      {maxQuantity} {selectedUnit}
                    </span>
                    {price && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                        {priceSourceLabels[price.source]}
                      </span>
                    )}
                    {price === undefined && (
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 font-medium text-warning-foreground">
                        Price confirm
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Select
                  value={selectedUnit}
                  onValueChange={(value) => handleUnitChange(product, value as UnitType)}
                >
                  <SelectTrigger className="h-10 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((option) => (
                      <SelectItem key={option.unit} value={option.unit}>
                        {formatUnits(option.unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center rounded-md border border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() =>
                      selectedUnit && setCartQuantity(product, selectedUnit, quantity - 1)
                    }
                    disabled={quantity <= 0}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="w-9 text-center text-base font-semibold">{quantity}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() =>
                      selectedUnit && setCartQuantity(product, selectedUnit, quantity + 1)
                    }
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}

        {visibleProducts.length === 0 && (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No products found.
          </div>
        )}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {cartItems.map((item) => {
              const price = currentBuyer
                ? buyerVisiblePrice(state, currentBuyer.customerId, item.productId, item.unit)
                : undefined;
              const maxQuantity = getMaxSaleQuantityFromStock(
                item.product,
                item.product.stock,
                item.unit,
              );

              return (
                <div key={item.productId} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold">{item.product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {price === undefined ? "Confirm" : fmtMoney(price.price * item.quantity)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Max {maxQuantity} {item.unit}
                    </p>
                    <div className="flex items-center rounded-md border border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() =>
                          item.unit && setCartQuantity(item.product, item.unit, item.quantity - 1)
                        }
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="w-10 text-center text-sm font-semibold">{item.quantity}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() =>
                          item.unit && setCartQuantity(item.product, item.unit, item.quantity + 1)
                        }
                        disabled={item.quantity >= maxQuantity}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buyer-order-note">Note</Label>
            <Textarea
              id="buyer-order-note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Delivery note"
            />
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated total</span>
              <span className="font-bold">{cartTotal > 0 ? fmtMoney(cartTotal) : "Confirm"}</span>
            </div>
            {pricedItemCount < cartItems.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                Some prices will be confirmed by the seller.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Back
            </Button>
            <Button onClick={placeOrder}>Send Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MobileStat({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: string;
  icon: typeof PackageCheck;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            danger ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </div>
      <p className={cn("truncate text-sm font-bold", danger && "text-destructive")}>{value}</p>
    </div>
  );
}
