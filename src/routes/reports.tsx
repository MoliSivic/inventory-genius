import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, fmtMoney } from "@/lib/store";
import { PageHeader, PageSection, StatCard } from "@/components/app/StatCard";
import { AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ReportsPage() {
  const { state } = useStore();
  const [from, setFrom] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [to, setTo] = useState(() => formatDateForInput(new Date()));
  const [customerId, setCustomerId] = useState("all");
  const [productId, setProductId] = useState("all");

  const sales = useMemo(
    () =>
      state.sales.filter((s) => {
        if (from && s.date < from) return false;
        if (to && s.date > to) return false;
        if (customerId !== "all" && s.customerId !== customerId) return false;
        if (productId !== "all" && !s.items.some((it) => it.productId === productId)) return false;
        return true;
      }),
    [state.sales, from, to, customerId, productId],
  );

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalProfit = sales.reduce((a, s) => a + s.estimatedProfit, 0);
  const totalDebt = sales.reduce((a, s) => a + Math.max(s.total - s.paidAmount, 0), 0);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { sales: number; profit: number }>();
    for (const s of sales) {
      const e = map.get(s.customerId) ?? { sales: 0, profit: 0 };
      e.sales += s.total;
      e.profit += s.estimatedProfit;
      map.set(s.customerId, e);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        name: state.customers.find((c) => c.id === id)?.name ?? "—",
        ...v,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [sales, state.customers]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { qty: number; sales: number; profit: number }>();
    for (const s of sales) {
      for (const it of s.items) {
        if (productId !== "all" && it.productId !== productId) continue;
        const e = map.get(it.productId) ?? { qty: 0, sales: 0, profit: 0 };
        e.qty += it.quantity;
        e.sales += it.quantity * it.unitPrice;
        e.profit += (it.unitPrice - it.avgCostAtSale) * it.quantity;
        map.set(it.productId, e);
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        name: state.products.find((p) => p.id === id)?.name ?? "—",
        ...v,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [sales, state.products, productId]);

  return (
    <div>
      <PageHeader
        title="Profit Reports"
        description="Estimated profit reports — based on current stock-in cost layers."
      />

      <PageSection title="Filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {state.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {state.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageSection>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <StatCard label="Sales" value={fmtMoney(totalSales)} icon={DollarSign} tone="primary" />
        <StatCard
          label="Estimated Profit"
          value={fmtMoney(totalProfit)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Total Debt"
          value={fmtMoney(totalDebt)}
          icon={AlertTriangle}
          tone={totalDebt > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <PageSection title="By Customer">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium text-right">Sales</th>
                <th className="py-2 font-medium text-right">Est. Profit</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right">{fmtMoney(r.sales)}</td>
                  <td className="py-2 text-right text-success">{fmtMoney(r.profit)}</td>
                </tr>
              ))}
              {byCustomer.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PageSection>

        <PageSection title="By Product">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium text-right">Qty</th>
                <th className="py-2 font-medium text-right">Est. Profit</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right">{r.qty}</td>
                  <td className="py-2 text-right text-success">{fmtMoney(r.profit)}</td>
                </tr>
              ))}
              {byProduct.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PageSection>
      </div>
    </div>
  );
}
