import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, fmtMoney } from "@/lib/store";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compareTextWithAscendingNumbers, parseNumericInput } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/customer-prices/setup")({
  component: CustomerPricesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    customerId: typeof search.customerId === "string" ? search.customerId : "",
    mode: search.mode === "view" ? "view" : "edit",
  }),
});

type CostBasis = "safe" | "blended" | "current";

const DEFAULT_TARGET_MARGIN = 15;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function resolveBlendedCost(product: Product) {
  if (product.stock <= 0.0001) return product.avgCost;
  return product.totalCostBasis / product.stock;
}

function resolveBaseCost(product: Product, costBasis: CostBasis) {
  const currentCost = product.avgCost;
  const blendedCost = resolveBlendedCost(product);

  if (costBasis === "current") return currentCost;
  if (costBasis === "blended") return blendedCost;
  return Math.max(currentCost, blendedCost);
}

function CustomerPricesPage() {
  const { state, setCustomerProductPrices } = useStore();
  const { customerId, mode } = Route.useSearch();
  const isViewMode = mode === "view";
  const selectedCustomerId = customerId;
  const [costBasis, setCostBasis] = useState<CostBasis>("safe");
  const [targetMargin, setTargetMargin] = useState(DEFAULT_TARGET_MARGIN);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const recentProductPricesByCustomer = useMemo(() => {
    const sortedSales = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
    const byCustomer = new Map<
      string,
      Array<{ productId: string; price: number; lastBoughtDate: string }>
    >();
    const seenByCustomer = new Map<string, Set<string>>();

    for (const sale of sortedSales) {
      const seenProducts = seenByCustomer.get(sale.customerId) ?? new Set<string>();
      const rows = byCustomer.get(sale.customerId) ?? [];

      for (const item of sale.items) {
        if (seenProducts.has(item.productId)) continue;

        seenProducts.add(item.productId);
        rows.push({
          productId: item.productId,
          price: item.unitPrice,
          lastBoughtDate: sale.date,
        });
      }

      seenByCustomer.set(sale.customerId, seenProducts);
      byCustomer.set(sale.customerId, rows);
    }

    return byCustomer;
  }, [state.sales]);

  const rememberedProductPricesByCustomer = useMemo(() => {
    const byCustomer = new Map<string, Map<string, number>>();

    for (const customerPrice of [...state.customerPrices].reverse()) {
      const customerPrices = byCustomer.get(customerPrice.customerId) ?? new Map<string, number>();
      if (!byCustomer.has(customerPrice.customerId)) {
        byCustomer.set(customerPrice.customerId, customerPrices);
      }

      if (!customerPrices.has(customerPrice.productId)) {
        customerPrices.set(customerPrice.productId, customerPrice.price);
      }
    }

    return byCustomer;
  }, [state.customerPrices]);

  useEffect(() => {
    setDraftPrices({});
  }, [selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => state.customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [selectedCustomerId, state.customers],
  );

  const selectedRememberedPrices = useMemo(
    () => rememberedProductPricesByCustomer.get(selectedCustomerId) ?? new Map<string, number>(),
    [rememberedProductPricesByCustomer, selectedCustomerId],
  );

  const selectedRecentPrices = useMemo(() => {
    const rowsForCustomer = recentProductPricesByCustomer.get(selectedCustomerId) ?? [];
    return new Map(rowsForCustomer.map((row) => [row.productId, row] as const));
  }, [recentProductPricesByCustomer, selectedCustomerId]);

  const setupRows = useMemo(() => {
    if (!selectedCustomerId) return [];

    const normalizedMargin = Number.isFinite(targetMargin) ? Math.max(targetMargin, 0) : 0;
    const marginMultiplier = 1 + normalizedMargin / 100;

    return [...state.products]
      .sort((a, b) => compareTextWithAscendingNumbers(a.name, b.name))
      .map((product) => {
        const rememberedPrice = selectedRememberedPrices.get(product.id);
        const recentPrice = selectedRecentPrices.get(product.id);
        const currentCost = roundMoney(product.avgCost);
        const blendedCost = roundMoney(resolveBlendedCost(product));
        const baseCost = roundMoney(resolveBaseCost(product, costBasis));
        const suggestedPrice = roundMoney(baseCost * marginMultiplier);
        const draftValue = draftPrices[product.id];
        const displayValue =
          draftValue !== undefined
            ? draftValue
            : rememberedPrice !== undefined
              ? rememberedPrice.toFixed(2)
              : "";

        const hasDisplayValue = displayValue.trim() !== "";
        const parsedDisplayValue = hasDisplayValue ? parseNumericInput(displayValue) : NaN;
        const effectivePrice = Number.isFinite(parsedDisplayValue) ? parsedDisplayValue : undefined;
        const marginPercent =
          effectivePrice !== undefined && baseCost > 0
            ? ((effectivePrice - baseCost) / baseCost) * 100
            : undefined;

        return {
          product,
          currentCost,
          blendedCost,
          suggestedPrice,
          rememberedPrice,
          recentPrice: recentPrice?.price,
          recentDate: recentPrice?.lastBoughtDate ?? "-",
          displayValue,
          marginPercent,
        };
      });
  }, [
    costBasis,
    draftPrices,
    selectedRememberedPrices,
    selectedRecentPrices,
    selectedCustomerId,
    state.products,
    targetMargin,
  ]);

  const changedDraftCount = useMemo(() => Object.keys(draftPrices).length, [draftPrices]);

  const updateDraftPrice = (productId: string, value: string) => {
    if (isViewMode) return;
    setDraftPrices((current) => ({ ...current, [productId]: value }));
  };

  const applySuggestedPrices = (onlyEmpty: boolean) => {
    if (isViewMode) return;

    setDraftPrices((current) => {
      const next = { ...current };

      setupRows.forEach((row) => {
        const currentValue =
          current[row.product.id] ??
          (row.rememberedPrice !== undefined ? row.rememberedPrice.toFixed(2) : "");
        const parsedCurrentValue = parseNumericInput(currentValue);
        const hasCurrentValue =
          currentValue.trim() !== "" &&
          Number.isFinite(parsedCurrentValue) &&
          parsedCurrentValue > 0;

        if (onlyEmpty && hasCurrentValue) return;
        next[row.product.id] = row.suggestedPrice.toFixed(2);
      });

      return next;
    });
  };

  const saveSetupPrices = () => {
    if (isViewMode) return;

    if (!selectedCustomerId) {
      toast.error("Please open setup from the Customer-Specific Prices list.");
      return;
    }

    const updates: Array<{ productId: string; price: number | null }> = [];

    for (const [productId, rawValue] of Object.entries(draftPrices)) {
      const normalizedValue = rawValue.trim();
      if (normalizedValue === "") {
        updates.push({ productId, price: null });
        continue;
      }

      const parsedValue = parseNumericInput(normalizedValue);
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        toast.error("Price must be a valid non-negative number.");
        return;
      }

      if (parsedValue <= 0) {
        updates.push({ productId, price: null });
        continue;
      }

      updates.push({ productId, price: Number(parsedValue.toFixed(2)) });
    }

    if (updates.length === 0) {
      toast.message("No price changes to save.");
      return;
    }

    setCustomerProductPrices(selectedCustomerId, updates);
    toast.success("Customer prices saved.");
    setDraftPrices({});
  };

  return (
    <div>
      <PageHeader
        title={isViewMode ? "Customer Price View" : "Customer Price Setup"}
        description={
          isViewMode
            ? "Review remembered and suggested prices for a selected customer."
            : "Set customer-specific prices for a selected customer."
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/customer-prices">Back to Customer Prices</Link>
          </Button>
        }
      />

      <PageSection
        title={isViewMode ? "Price Template" : "Price Setup"}
        description={
          selectedCustomer
            ? `${selectedCustomer.name} (${selectedCustomer.market})`
            : "Open this page from Customer-Specific Prices to choose a customer."
        }
        contentClassName="space-y-4"
      >
        {!selectedCustomer ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No customer selected. Open View or Set Prices from Customer-Specific Prices.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label>Cost Basis</Label>
                <Select
                  value={costBasis}
                  onValueChange={(value) => setCostBasis(value as CostBasis)}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safe">Safe (recommended)</SelectItem>
                    <SelectItem value="blended">Blended cost (old + new stock)</SelectItem>
                    <SelectItem value="current">Current cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target Margin %</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Math.max(parseNumericInput(e.target.value), 0))}
                  disabled={isViewMode}
                />
              </div>

              {!isViewMode && (
                <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applySuggestedPrices(true)}
                  >
                    Fill Empty
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applySuggestedPrices(false)}
                  >
                    Apply Suggested
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Safe basis uses the higher of Current Cost and Blended Cost to protect margin when
                new stock cost rises.
              </p>
              <p>
                {isViewMode
                  ? `${setupRows.length} product row${setupRows.length === 1 ? "" : "s"}`
                  : `${changedDraftCount} changed row${changedDraftCount === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[1180px]">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Stock</th>
                    <th className="px-3 py-2 font-medium text-right">Current Cost</th>
                    <th className="px-3 py-2 font-medium text-right">Blended Cost</th>
                    <th className="px-3 py-2 font-medium text-right">Last Sale</th>
                    <th className="px-3 py-2 font-medium text-right">Last Sold Date</th>
                    <th className="px-3 py-2 font-medium text-right">Saved Price</th>
                    <th className="px-3 py-2 font-medium text-right">Suggested</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {isViewMode ? "Price" : "Set Price"}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {setupRows.map((row) => (
                    <tr key={row.product.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.product.name}</p>
                        <p className="text-xs text-muted-foreground">{row.product.category}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{row.product.stock.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(row.currentCost)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(row.blendedCost)}</td>
                      <td className="px-3 py-2 text-right">
                        {row.recentPrice !== undefined ? fmtMoney(row.recentPrice) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {row.recentDate}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.rememberedPrice !== undefined ? fmtMoney(row.rememberedPrice) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-primary font-medium">
                        {fmtMoney(row.suggestedPrice)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.displayValue}
                            onChange={(e) => updateDraftPrice(row.product.id, e.target.value)}
                            className="h-8 w-28 text-right"
                            disabled={isViewMode}
                          />
                          {!isViewMode && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateDraftPrice(row.product.id, row.suggestedPrice.toFixed(2))
                              }
                            >
                              Use
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.marginPercent === undefined ? (
                          "-"
                        ) : (
                          <span
                            className={
                              row.marginPercent < 0
                                ? "font-medium text-destructive"
                                : row.marginPercent >= Math.max(targetMargin, 0)
                                  ? "font-medium text-success"
                                  : "font-medium text-warning-foreground"
                            }
                          >
                            {row.marginPercent.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {setupRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!isViewMode && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDraftPrices({})}>
                  Reset Changes
                </Button>
                <Button onClick={saveSetupPrices} disabled={changedDraftCount === 0}>
                  Save Price Changes
                </Button>
              </div>
            )}
          </>
        )}
      </PageSection>
    </div>
  );
}
