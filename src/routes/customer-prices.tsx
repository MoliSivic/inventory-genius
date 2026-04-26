import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore, fmtMoney } from "@/lib/store";
import { normalizeMarkets, sameMarketName } from "@/lib/markets";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/customer-prices")({ component: CustomerPricesPage });

function CustomerPricesPage() {
  const { state } = useStore();
  const [market, setMarket] = useState("all");
  const [customer, setCustomer] = useState("all");
  const [search, setSearch] = useState("");
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);

  const markets = useMemo(
    () => normalizeMarkets(state.markets, state.customers),
    [state.markets, state.customers],
  );

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

  const customerOptions = useMemo(
    () =>
      state.customers.filter(
        (c) => market === "all" || sameMarketName(c.market, market),
      ),
    [state.customers, market],
  );

  useEffect(() => {
    if (customer === "all") return;
    if (!customerOptions.some((c) => c.id === customer)) {
      setCustomer("all");
    }
  }, [customer, customerOptions]);

  useEffect(() => {
    if (!viewingCustomerId) return;
    if (!state.customers.some((c) => c.id === viewingCustomerId)) {
      setViewingCustomerId(null);
    }
  }, [state.customers, viewingCustomerId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return customerOptions
      .filter((c) => {
        if (customer !== "all" && c.id !== customer) return false;

        const recentProducts = recentProductPricesByCustomer.get(c.id) ?? [];
        if (recentProducts.length === 0) return false;

        if (!q) return true;

        const matchesCustomer = c.name.toLowerCase().includes(q);
        if (matchesCustomer) return true;

        return recentProducts.some((row) => {
          const productName = state.products.find((p) => p.id === row.productId)?.name ?? "";
          return productName.toLowerCase().includes(q);
        });
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        market: c.market,
        recentProducts: recentProductPricesByCustomer.get(c.id) ?? [],
      }));
  }, [
    customer,
    customerOptions,
    recentProductPricesByCustomer,
    search,
    state.products,
  ]);

  const viewingCustomer = state.customers.find((c) => c.id === viewingCustomerId) ?? null;
  const viewingRows = viewingCustomerId
    ? recentProductPricesByCustomer.get(viewingCustomerId) ?? []
    : [];

  return (
    <div>
      <PageHeader title="Customer-Specific Prices" description="Remembered usual prices per customer. The latest sale price is auto-saved here." />
      <PageSection>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
          </div>
          <Select
            value={market}
            onValueChange={(value) => {
              setMarket(value);
              setCustomer("all");
            }}
          >
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Market" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All markets</SelectItem>
              {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customerOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-5 py-2 font-medium">Market</th>
                <th className="px-5 py-2 font-medium text-right">Recent Products</th>
                <th className="px-5 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2 font-medium">{row.name}</td>
                  <td className="px-5 py-2">{row.market}</td>
                  <td className="px-5 py-2 text-right">{row.recentProducts.length}</td>
                  <td className="px-5 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setViewingCustomerId(row.id)}>
                      View Prices
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No prices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </PageSection>

      <Dialog open={!!viewingCustomer} onOpenChange={(open) => !open && setViewingCustomerId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewingCustomer?.name ?? "Customer"} Recent Product Prices
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">Last Bought</th>
                  <th className="px-2 py-2 font-medium text-right">Usual Price</th>
                </tr>
              </thead>
              <tbody>
                {viewingRows.map((row) => (
                  <tr key={row.productId} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-2">
                      {state.products.find((p) => p.id === row.productId)?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2">{row.lastBoughtDate}</td>
                    <td className="px-2 py-2 text-right font-medium">{fmtMoney(row.price)}</td>
                  </tr>
                ))}
                {viewingRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-8 text-center text-muted-foreground">
                      No recent products for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCustomerId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}