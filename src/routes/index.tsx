import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  PackagePlus,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useStore, fmtMoney, customerTotals, formatUnits } from "@/lib/store";
import {
  getDisplayStockUnitQuantity,
  getDisplaySubUnitQuantity,
  getProductSaleSubUnitOption,
} from "@/lib/sale-units";
import { PageHeader, StatCard, PageSection, StatusBadge } from "@/components/app/StatCard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const stats = useMemo(() => {
    const todaySales = state.sales.filter((s) => s.date === today);
    const monthlySales = state.sales.filter((s) => s.date.startsWith(month));
    const todayTotal = todaySales.reduce((a, s) => a + s.total, 0);
    const monthlyTotal = monthlySales.reduce((a, s) => a + s.total, 0);
    const monthlyProfit = monthlySales.reduce((a, s) => a + s.estimatedProfit, 0);
    const lowStock = state.products.filter((p) => p.stock <= p.minStock);
    return { todayTotal, monthlyTotal, monthlyProfit, lowStock };
  }, [state, today, month]);

  const topCustomers = useMemo(() => {
    return state.customers
      .map((c) => ({ c, ...customerTotals(state, c.id) }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);
  }, [state]);

  const recentSales = state.sales.slice(0, 5);
  const recentStockIn = state.stockIns.slice(0, 5);

  const productName = (id: string) => state.products.find((p) => p.id === id)?.name ?? "—";
  const factoryName = (id: string) => state.factories.find((f) => f.id === id)?.name ?? "—";
  const customerName = (id: string) => state.customers.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of today's business, profits, and stock alerts."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today Sales"
          value={fmtMoney(stats.todayTotal)}
          icon={ShoppingCart}
          tone="primary"
        />
        <StatCard
          label="Monthly Sales"
          value={fmtMoney(stats.monthlyTotal)}
          icon={DollarSign}
          tone="success"
        />
        <StatCard
          label="Estimated Profit (Month)"
          value={fmtMoney(stats.monthlyProfit)}
          icon={TrendingUp}
          tone="success"
          hint="Based on current stock-in cost layers"
        />
        <StatCard
          label="Low Stock Items"
          value={String(stats.lowStock.length)}
          icon={AlertTriangle}
          tone={stats.lowStock.length ? "destructive" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PageSection
          title="Top Profitable Customers"
          description="By estimated profit"
          className="h-[12cm] flex flex-col"
          contentClassName="p-0 flex-1 min-h-0"
        >
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-5 py-2 font-medium">Market</th>
                  <th className="px-5 py-2 font-medium text-right">Sales</th>
                  <th className="px-5 py-2 font-medium text-right">Est. Profit</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                      No data yet
                    </td>
                  </tr>
                )}
                {topCustomers.map(({ c, totalSales, totalProfit }) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-medium">{c.name}</td>
                    <td className="px-5 py-2 text-muted-foreground">{c.market}</td>
                    <td className="px-5 py-2 text-right">{fmtMoney(totalSales)}</td>
                    <td className="px-5 py-2 text-right text-success font-medium">
                      {fmtMoney(totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection
          title="Low Stock Products"
          className="h-[12cm] flex flex-col"
          contentClassName="p-0 flex-1 min-h-0"
        >
          <div className="h-full overflow-auto p-5 space-y-2">
            {stats.lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All products are sufficiently stocked.
              </p>
            )}
            {stats.lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
              >
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">
                    {getDisplayStockUnitQuantity(p, p.stock)} {formatUnits(p.unit)}
                  </p>
                  {getProductSaleSubUnitOption(p) && (
                    <p className="text-[10px] text-muted-foreground">
                      {getDisplaySubUnitQuantity(p, p.stock)} {getProductSaleSubUnitOption(p)?.unit}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">min {p.minStock}</p>
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PageSection
          title="Recent Sales"
          actions={<ReceiptIcon className="h-4 w-4 text-muted-foreground" />}
          className="h-[12cm] flex flex-col"
          contentClassName="p-0 flex-1 min-h-0"
        >
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Receipt</th>
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-5 py-2">{customerName(s.customerId)}</td>
                    <td className="px-5 py-2 text-right font-medium">{fmtMoney(s.total)}</td>
                    <td className="px-5 py-2">
                      <StatusBadge status={s.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>

        <PageSection
          title="Recent Stock In"
          actions={<PackagePlus className="h-4 w-4 text-muted-foreground" />}
          className="h-[12cm] flex flex-col"
          contentClassName="p-0 flex-1 min-h-0"
        >
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Invoice</th>
                  <th className="px-5 py-2 font-medium">Factory</th>
                  <th className="px-5 py-2 font-medium">Items</th>
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentStockIn.map((si) => (
                  <tr key={si.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs">{si.invoiceNumber}</td>
                    <td className="px-5 py-2">{factoryName(si.factoryId)}</td>
                    <td className="px-5 py-2 text-xs text-muted-foreground">
                      {si.items.map((it) => productName(it.productId)).join(", ")}
                    </td>
                    <td className="px-5 py-2 text-right font-medium">{fmtMoney(si.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      </div>
    </div>
  );
}
