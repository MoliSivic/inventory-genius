import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { normalizeMarkets, sameMarketName } from "@/lib/markets";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/customer-prices")({ component: CustomerPricesPage });

function CustomerPricesPage() {
  const location = useLocation();

  const { state } = useStore();
  const [market, setMarket] = useState("all");
  const [search, setSearch] = useState("");

  const markets = useMemo(
    () => normalizeMarkets(state.markets, state.customers),
    [state.markets, state.customers],
  );

  const recentProductPricesByCustomer = useMemo(() => {
    const sortedSales = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
    const byCustomer = new Map<string, Map<string, string>>();

    for (const sale of sortedSales) {
      const products = byCustomer.get(sale.customerId) ?? new Map<string, string>();
      for (const item of sale.items) {
        if (!products.has(item.productId)) {
          products.set(item.productId, sale.date);
        }
      }
      byCustomer.set(sale.customerId, products);
    }

    return byCustomer;
  }, [state.sales]);

  const rememberedProductCountByCustomer = useMemo(() => {
    const byCustomer = new Map<string, Set<string>>();

    for (const customerPrice of state.customerPrices) {
      const products = byCustomer.get(customerPrice.customerId) ?? new Set<string>();
      products.add(customerPrice.productId);
      byCustomer.set(customerPrice.customerId, products);
    }

    return byCustomer;
  }, [state.customerPrices]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return state.customers
      .filter((customer) => {
        if (market !== "all" && !sameMarketName(customer.market, market)) return false;
        if (!q) return true;

        return customer.name.toLowerCase().includes(q) || customer.market.toLowerCase().includes(q);
      })
      .map((customer) => {
        const recentProducts = recentProductPricesByCustomer.get(customer.id) ?? new Map();
        const rememberedProducts = rememberedProductCountByCustomer.get(customer.id) ?? new Set();
        const trackedProductIds = new Set<string>([
          ...Array.from(recentProducts.keys()),
          ...Array.from(rememberedProducts.values()),
        ]);

        const latestBoughtDate =
          [...recentProducts.values()].sort((a, b) => b.localeCompare(a))[0] ?? "-";

        return {
          id: customer.id,
          name: customer.name,
          market: customer.market,
          trackedProducts: trackedProductIds.size,
          latestBoughtDate,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    market,
    rememberedProductCountByCustomer,
    recentProductPricesByCustomer,
    search,
    state.customers,
  ]);

  if (location.pathname.startsWith("/customer-prices/setup")) {
    return <Outlet />;
  }

  return (
    <div>
      <PageHeader
        title="Customer-Specific Prices"
        description="Filter by customer or market here, then use View to inspect and Set Prices to update customer pricing."
      />

      <PageSection>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="pl-9"
            />
          </div>

          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All markets</SelectItem>
              {markets.map((marketItem) => (
                <SelectItem key={marketItem} value={marketItem}>
                  {marketItem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-5 py-2 font-medium">Market</th>
                <th className="px-5 py-2 font-medium text-right">Tracked Products</th>
                <th className="px-5 py-2 font-medium text-right">Latest Bought</th>
                <th className="px-5 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2 font-medium">{row.name}</td>
                  <td className="px-5 py-2">{row.market}</td>
                  <td className="px-5 py-2 text-right">{row.trackedProducts}</td>
                  <td className="px-5 py-2 text-right text-muted-foreground">
                    {row.latestBoughtDate}
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to="/customer-prices/setup"
                          search={{ customerId: row.id, mode: "view" }}
                        >
                          View
                        </Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link
                          to="/customer-prices/setup"
                          search={{ customerId: row.id, mode: "edit" }}
                        >
                          Set Prices
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  );
}
