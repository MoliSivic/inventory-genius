import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Plus, Trash2, Send, Printer, Download, Search, X, ShoppingCart, FileText } from "lucide-react";
import { useStore, fmtMoney, suggestedPrice } from "@/lib/store";
import { normalizeCategories } from "@/lib/categories";
import {
  getProductSaleUnitOptions,
  convertStockUnitPriceToSaleUnitPrice,
  convertSaleQuantityToStockQuantity,
} from "@/lib/sale-units";
import { primaryUnit } from "@/lib/units";
import { PageHeader, PageSection, StatusBadge } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt } from "@/components/app/Receipt";
import { toast } from "sonner";
import type { PaymentStatus, Sale, UnitType } from "@/lib/types";

export const Route = createFileRoute("/sales")({ component: SalesPage });

interface Row { category: string; productId: string; saleUnit?: UnitType; quantity: number; unitPrice: number; }

const ALL = "all";

type ViewMode = "sale" | "receipt";

function SalesPage() {
  const { state, addSale, updateSaleTelegram } = useStore();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("sales_viewMode", "sale");
  const [marketFilter, setMarketFilter] = usePersistedState("sales_marketFilter", "all");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([{ category: ALL, productId: "", quantity: 0, unitPrice: 0 }]);
  const [paymentStatus, setPaymentStatus] = usePersistedState<PaymentStatus>("sales_paymentStatus", "paid");
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [generated, setGenerated] = useState<Sale | null>(null);

  const markets = useMemo(() => Array.from(new Set(state.customers.map((c) => c.market))), [state.customers]);
  const filteredCustomers = state.customers.filter((c) => marketFilter === "all" || c.market === marketFilter);
  const categoryOptions = useMemo(
    () => normalizeCategories(state.categories, state.products).map((c) => c.name),
    [state.categories, state.products],
  );

  // Recent sales filters
  const [rsSearch, setRsSearch] = usePersistedState("sales_rsSearch", "");
  const [rsMarket, setRsMarket] = usePersistedState("sales_rsMarket", "all");
  const [rsCustomer, setRsCustomer] = usePersistedState("sales_rsCustomer", "all");
  const [rsStatus, setRsStatus] = usePersistedState<"all" | PaymentStatus>("sales_rsStatus", "all");
  const [rsSort, setRsSort] = usePersistedState<"latest" | "oldest" | "highest" | "lowest" | "profit">("sales_rsSort", "latest");
  const [rsFrom, setRsFrom] = usePersistedState("sales_rsFrom", "");
  const [rsTo, setRsTo] = usePersistedState("sales_rsTo", "");

  const recentSales = useMemo(() => {
    const customerById = new Map(state.customers.map((c) => [c.id, c]));
    let list = state.sales.filter((s) => {
      const c = customerById.get(s.customerId);
      if (rsMarket !== "all" && c?.market !== rsMarket) return false;
      if (rsCustomer !== "all" && s.customerId !== rsCustomer) return false;
      if (rsStatus !== "all" && s.paymentStatus !== rsStatus) return false;
      if (rsFrom && s.date < rsFrom) return false;
      if (rsTo && s.date > rsTo) return false;
      if (rsSearch.trim()) {
        const q = rsSearch.toLowerCase();
        const name = c?.name.toLowerCase() ?? "";
        if (!s.receiptNumber.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (rsSort) {
        case "oldest": return a.date.localeCompare(b.date);
        case "highest": return b.total - a.total;
        case "lowest": return a.total - b.total;
        case "profit": return b.estimatedProfit - a.estimatedProfit;
        default: return b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [state.sales, state.customers, rsSearch, rsMarket, rsCustomer, rsStatus, rsSort, rsFrom, rsTo]);

  const rsCustomerOptions = useMemo(
    () => state.customers.filter((c) => rsMarket === "all" || c.market === rsMarket),
    [state.customers, rsMarket],
  );

  const rsTotals = useMemo(() => ({
    count: recentSales.length,
    total: recentSales.reduce((a, s) => a + s.total, 0),
    profit: recentSales.reduce((a, s) => a + s.estimatedProfit, 0),
    outstanding: recentSales.reduce((a, s) => a + (s.total - s.paidAmount), 0),
  }), [recentSales]);

  const clearRsFilters = () => {
    setRsSearch(""); setRsMarket("all"); setRsCustomer("all");
    setRsStatus("all"); setRsSort("latest"); setRsFrom(""); setRsTo("");
  };

  const total = useMemo(() => rows.reduce((a, r) => a + r.quantity * r.unitPrice, 0), [rows]);
  const estProfit = useMemo(() => rows.reduce((a, r) => {
    const p = state.products.find((x) => x.id === r.productId);
    if (!p) return a;
    // Convert avgCost to sale-unit cost for proper profit calculation
    const costPerSaleUnit = convertStockUnitPriceToSaleUnitPrice(p, p.avgCost, r.saleUnit);
    return a + (r.unitPrice - costPerSaleUnit) * r.quantity;
  }, 0), [rows, state.products]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      // when product changes, set default unit and suggest price
      if (patch.productId) {
        const product = state.products.find((x) => x.id === patch.productId);
        if (product) {
          const unitOptions = getProductSaleUnitOptions(product);
          next.saleUnit = unitOptions[0].unit; // default to stock unit
        }
        if (customerId) {
          const sug = suggestedPrice(state, customerId, patch.productId, next.saleUnit);
          if (sug !== undefined) next.unitPrice = sug;
        }
      }
      return next;
    }));
  };
  const addRow = () => setRows((prev) => [
    ...prev,
    { category: prev.at(-1)?.category ?? ALL, productId: "", quantity: 0, unitPrice: 0 },
  ]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  // when customer changes, refresh suggested prices
  const onCustomerChange = (id: string) => {
    setCustomerId(id);
    setRows((rs) => rs.map((r) => {
      if (!r.productId) return r;
      const sug = suggestedPrice(state, id, r.productId, r.saleUnit);
      return sug !== undefined ? { ...r, unitPrice: sug } : r;
    }));
  };

  // sync paidAmount with status
  const onStatusChange = (s: PaymentStatus) => {
    setPaymentStatus(s);
    if (s === "paid") setPaidAmount(total);
    else if (s === "unpaid") setPaidAmount(0);
  };

  const submit = () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (rows.some((r) => !r.productId || r.quantity <= 0 || r.unitPrice < 0)) { toast.error("Check item rows"); return; }
    const finalPaid = paymentStatus === "paid" ? total : paymentStatus === "unpaid" ? 0 : paidAmount;
    const result = addSale({
      customerId, date,
      items: rows.map((r) => ({ productId: r.productId, quantity: r.quantity, unit: r.saleUnit, unitPrice: r.unitPrice })),
      paidAmount: finalPaid, paymentStatus, notes: notes || undefined,
    });
    if ("error" in result) { toast.error(result.error); return; }
    toast.success(`Sale recorded — ${result.receiptNumber}`);
    setGenerated(result);
    // reset
    setRows([{ category: ALL, productId: "", quantity: 0, unitPrice: 0 }]);
    setNotes(""); setPaidAmount(0); setPaymentStatus("paid");
  };

  const customer = state.customers.find((c) => c.id === customerId);

  return (
    <div>
      <PageHeader
        title="Sales"
        description={viewMode === "sale" ? "Create a sale, system suggests customer's usual price (editable)." : "View and manage your past sales receipts."}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={viewMode === "sale" ? "default" : "outline"}
              onClick={() => setViewMode("sale")}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Sale Mode
            </Button>
            <Button
              variant={viewMode === "receipt" ? "default" : "outline"}
              onClick={() => setViewMode("receipt")}
            >
              <FileText className="h-4 w-4 mr-1" />
              View Receipt
            </Button>
          </div>
        }
      />

      {viewMode === "sale" && <PageSection title="New Sale">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Filter by Market</Label>
            <Select value={marketFilter} onValueChange={(v) => { setMarketFilter(v); setCustomerId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={onCustomerChange}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {filteredCustomers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.market}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium w-12">No.</th>
                <th className="px-5 py-2 font-medium w-40">Category</th>
                <th className="px-5 py-2 font-medium">Product</th>
                <th className="px-5 py-2 font-medium w-20">Stock</th>
                <th className="px-5 py-2 font-medium w-20">Cost</th>
                <th className="px-5 py-2 font-medium w-28">Qty</th>
                <th className="px-5 py-2 font-medium w-24">Unit</th>
                <th className="px-5 py-2 font-medium w-28">Price</th>
                <th className="px-5 py-2 font-medium text-right w-28">Subtotal</th>
                <th className="px-5 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const productOptions = state.products.filter(
                  (pp) => r.category === ALL || pp.category === r.category,
                );
                const p = state.products.find((x) => x.id === r.productId);
                const unitOptions = p ? getProductSaleUnitOptions(p) : [];
                const hasMultipleUnits = unitOptions.length > 1;
                const sug = customerId && r.productId ? suggestedPrice(state, customerId, r.productId, r.saleUnit) : undefined;
                const costPerUnit = p ? convertStockUnitPriceToSaleUnitPrice(p, p.avgCost, r.saleUnit) : 0;
                return (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 text-xs font-medium text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3">
                      <Select
                        value={r.category}
                        onValueChange={(v) => {
                          setRows((rs) => rs.map((row, idx) => {
                            if (idx !== i) return row;
                            const currentProduct = state.products.find((pp) => pp.id === row.productId);
                            const keepProduct = currentProduct && (v === ALL || currentProduct.category === v);
                            return { ...row, category: v, productId: keepProduct ? row.productId : "", saleUnit: keepProduct ? row.saleUnit : undefined, unitPrice: keepProduct ? row.unitPrice : 0 };
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All categories</SelectItem>
                          {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <Select value={r.productId} onValueChange={(v) => updateRow(i, { productId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{productOptions.map((pp) => <SelectItem key={pp.id} value={pp.id}>{pp.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3 text-xs">{p ? `${p.stock} ${primaryUnit(p.unit)}` : "—"}</td>
                    <td className="px-5 py-3 text-xs">{p ? fmtMoney(costPerUnit) : "—"}</td>
                    <td className="px-5 py-3"><Input type="number" min={0} value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })} /></td>
                    <td className="px-5 py-3">
                      {hasMultipleUnits ? (
                        <Select
                          value={r.saleUnit ?? primaryUnit(p!.unit)}
                          onValueChange={(v) => {
                            const newUnit = v as UnitType;
                            setRows((rs) => rs.map((row, idx) => {
                              if (idx !== i) return row;
                              // Try to get suggested price for new unit
                              const newSug = customerId ? suggestedPrice(state, customerId, row.productId, newUnit) : undefined;
                              return { ...row, saleUnit: newUnit, unitPrice: newSug ?? row.unitPrice };
                            }));
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {unitOptions.map((opt) => (
                              <SelectItem key={opt.unit} value={opt.unit}>{opt.unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-medium">{p ? primaryUnit(p.unit) : "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Input type="number" step="0.01" min={0} value={r.unitPrice} onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })} />
                      {sug !== undefined && <p className="text-[10px] text-muted-foreground mt-0.5">Usual: {fmtMoney(sug)}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{fmtMoney(r.quantity * r.unitPrice)}</td>
                    <td className="px-5 py-3 text-right">
                      {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={8} className="px-5 py-3"><Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" />Add Item</Button></td>
                <td className="px-5 py-3 text-right font-bold">{fmtMoney(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">Total Sale</p>
            <p className="text-xl font-bold">{fmtMoney(total)}</p>
          </div>
          <div className="rounded-lg border border-success/30 p-3 bg-success/5">
            <p className="text-xs text-muted-foreground">Estimated Profit</p>
            <p className="text-xl font-bold text-success">{fmtMoney(estProfit)}</p>
            <p className="text-[10px] text-muted-foreground">Based on weighted avg cost</p>
          </div>
          <div>
            <Label>Payment</Label>
            <Select value={paymentStatus} onValueChange={(v) => onStatusChange(v as PaymentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            {paymentStatus === "partial" && (
              <Input type="number" step="0.01" min={0} max={total} value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} placeholder="Paid amount" className="mt-2" />
            )}
          </div>
        </div>

        <div className="mt-4">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} size="lg">Save Sale & Generate Receipt</Button>
        </div>
      </PageSection>}

      <ReceiptDialog sale={generated} onClose={() => setGenerated(null)} onShare={(status) => { if (generated) { updateSaleTelegram(generated.id, status); toast.success("Receipt is ready to share through Telegram."); } }} />

      {viewMode === "receipt" && <PageSection title="Recent Sales">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Receipt or customer..." value={rsSearch} onChange={(e) => setRsSearch(e.target.value)} />
            </div>
            <Select value={rsMarket} onValueChange={(v) => { setRsMarket(v); setRsCustomer("all"); }}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="Market" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rsCustomer} onValueChange={setRsCustomer}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {rsCustomerOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rsStatus} onValueChange={(v) => setRsStatus(v as typeof rsStatus)}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select value={rsSort} onValueChange={(v) => setRsSort(v as typeof rsSort)}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest total</SelectItem>
                <SelectItem value="lowest">Lowest total</SelectItem>
                <SelectItem value="profit">Top profit</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={rsFrom} onChange={(e) => setRsFrom(e.target.value)} className="sm:w-44" />
            <Input type="date" value={rsTo} onChange={(e) => setRsTo(e.target.value)} className="sm:w-44" />
            <Button variant="outline" onClick={clearRsFilters}><X className="h-4 w-4 mr-1" />Clear</Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span><b className="text-foreground">{rsTotals.count}</b> sales</span>
            <span>Total: <b className="text-foreground">{fmtMoney(rsTotals.total)}</b></span>
            <span>Profit: <b className="text-success">{fmtMoney(rsTotals.profit)}</b></span>
            <span>Outstanding: <b className="text-destructive">{fmtMoney(rsTotals.outstanding)}</b></span>
          </div>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Receipt</th>
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                  <th className="px-5 py-2 font-medium text-right">Est. Profit</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No sales match these filters.</td></tr>
                ) : recentSales.map((s) => {
                  const c = state.customers.find((cc) => cc.id === s.customerId);
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 font-mono text-xs">{s.receiptNumber}</td>
                      <td className="px-5 py-3">{s.date}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{c?.name ?? "—"}</p>
                        {c && <p className="text-xs text-muted-foreground">{c.market}</p>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">{fmtMoney(s.total)}</td>
                      <td className="px-5 py-3 text-right text-success">{fmtMoney(s.estimatedProfit)}</td>
                      <td className="px-5 py-3"><StatusBadge status={s.paymentStatus} /></td>
                      <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setGenerated(s)}>Receipt</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PageSection>}
    </div>
  );
}

function ReceiptDialog({ sale, onClose, onShare }: { sale: Sale | null; onClose: () => void; onShare: (status: "customer" | "owner" | "both") => void }) {
  const { state } = useStore();
  if (!sale) return null;
  const customer = state.customers.find((c) => c.id === sale.customerId);

  const handlePrint = () => {
    const el = document.getElementById("receipt-printable");
    if (!el) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>${sale.receiptNumber}</title><style>body{font-family:monospace;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:4px;font-size:12px}thead{border-bottom:1px solid #999}.flex{display:flex;justify-content:space-between}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const handleDownload = () => {
    const el = document.getElementById("receipt-printable");
    if (!el) return;
    const html = `<html><head><title>${sale.receiptNumber}</title><meta charset="utf-8"></head><body>${el.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${sale.receiptNumber}.html`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
        <Receipt sale={sale} customer={customer} products={state.products} shopName={state.shopName} />
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-4 w-4 mr-1" />Download</Button>
          <Button size="sm" onClick={() => onShare("customer")}><Send className="h-4 w-4 mr-1" />Send to Customer</Button>
          <Button size="sm" variant="secondary" onClick={() => onShare("owner")}>Send to Owner</Button>
          <Button size="sm" variant="secondary" onClick={() => onShare("both")}>Both</Button>
        </DialogFooter>
        <p className="text-[10px] text-muted-foreground text-center">Telegram Bot integration can be added later.</p>
      </DialogContent>
    </Dialog>
  );
}