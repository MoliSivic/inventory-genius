import { createFileRoute } from "@tanstack/react-router";
import { useStore, fmtMoney, customerTotals, formatUnits } from "@/lib/store";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/exports")({ component: ExportsPage });

function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}

function ExportsPage() {
  const { state } = useStore();

  const exportInventory = () =>
    download(
      "inventory.csv",
      toCSV([
        ["Name", "Category", "Unit", "Stock", "Current Cost", "Min Stock"],
        ...state.products.map((p) => [
          p.name,
          p.category,
          formatUnits(p.unit),
          p.stock,
          p.avgCost,
          p.minStock,
        ]),
      ]),
    );

  const exportSales = () =>
    download(
      "sales.csv",
      toCSV([
        ["Receipt", "Date", "Customer", "Total", "Paid", "Status", "Est. Profit"],
        ...state.sales.map((s) => [
          s.receiptNumber,
          s.date,
          state.customers.find((c) => c.id === s.customerId)?.name ?? "",
          s.total,
          s.paidAmount,
          s.paymentStatus,
          s.estimatedProfit,
        ]),
      ]),
    );

  const exportDebts = () =>
    download(
      "debts.csv",
      toCSV([
        ["Customer", "Market", "Total Sales", "Debt"],
        ...state.customers.map((c) => {
          const t = customerTotals(state, c.id);
          return [c.name, c.market, t.totalSales, t.debt];
        }),
      ]),
    );

  const exportProfits = () =>
    download(
      "profit-report.csv",
      toCSV([
        ["Receipt", "Date", "Customer", "Total", "Est. Profit"],
        ...state.sales.map((s) => [
          s.receiptNumber,
          s.date,
          state.customers.find((c) => c.id === s.customerId)?.name ?? "",
          s.total,
          s.estimatedProfit,
        ]),
      ]),
    );

  const exportStockIn = () =>
    download(
      "stock-in.csv",
      toCSV([
        ["Invoice", "Date", "Factory", "Items", "Total"],
        ...state.stockIns.map((s) => [
          s.invoiceNumber,
          s.date,
          state.factories.find((f) => f.id === s.factoryId)?.name ?? "",
          s.items.length,
          s.total,
        ]),
      ]),
    );

  const items = [
    { label: "Inventory Report", desc: "Products, stock, current cost", action: exportInventory },
    { label: "Sales Report", desc: "All sales transactions", action: exportSales },
    { label: "Customer Debt Report", desc: "Outstanding balances", action: exportDebts },
    { label: "Estimated Profit Report", desc: "Per-sale profit", action: exportProfits },
    { label: "Stock-In Report", desc: "Purchases from factories", action: exportStockIn },
  ];

  return (
    <div>
      <PageHeader title="Exports" description="Download CSV reports for any data view." />
      <PageSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.label} className="border border-border rounded-lg p-4 flex flex-col">
              <p className="font-semibold">{it.label}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{it.desc}</p>
              <Button size="sm" onClick={it.action} className="mt-auto">
                <FileDown className="h-4 w-4 mr-1" />
                Download CSV
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Totals snapshot: {state.products.length} products · {state.sales.length} sales ·{" "}
          {fmtMoney(state.sales.reduce((a, s) => a + s.total, 0))} lifetime sales.
        </p>
      </PageSection>
    </div>
  );
}
