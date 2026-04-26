import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Trash2, Upload, ImageIcon, X, Pencil } from "lucide-react";
import { useStore, fmtMoney, formatUnits } from "@/lib/store";
import { normalizeCategories } from "@/lib/categories";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { displayZeroAsPlaceholder, parseNumericInput } from "@/lib/utils";
import { toast } from "sonner";
import type { StockInInvoice } from "@/lib/types";

export const Route = createFileRoute("/stock-in")({ component: StockInPage });

const ALL_CATEGORIES = "all";

interface Row {
  category: string;
  productId: string;
  quantity: number;
  buyPrice: number;
}

function StockInPage() {
  const { state, addStockIn, updateStockIn } = useStore();
  const firstProduct = state.products[0];
  const categoryOptions = useMemo(
    () => normalizeCategories(state.categories, state.products).map((category) => category.name),
    [state.categories, state.products],
  );
  const [mode, setMode] = useState<"stock-in" | "history">("stock-in");
  const [factoryId, setFactoryId] = useState(state.factories[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${1000 + state.stockIns.length + 1}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([
    {
      category: firstProduct?.category ?? ALL_CATEGORIES,
      productId: firstProduct?.id ?? "",
      quantity: 0,
      buyPrice: 0,
    },
  ]);
  const [photo, setPhoto] = useState<string | undefined>();
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const total = useMemo(() => rows.reduce((a, r) => a + r.quantity * r.buyPrice, 0), [rows]);
  const viewingInvoice = state.stockIns.find((invoice) => invoice.id === viewingInvoiceId) ?? null;

  const buildRow = (preferredCategory = ALL_CATEGORIES): Row => ({
    category: preferredCategory,
    productId: "",
    quantity: 0,
    buyPrice: 0,
  });

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((currentRows) =>
      currentRows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );

  const onCategoryChange = (i: number, nextCategory: string) => {
    setRows((currentRows) =>
      currentRows.map((row, idx) => {
        if (idx !== i) return row;

        const currentProduct = state.products.find((product) => product.id === row.productId);
        const keepCurrentProduct =
          currentProduct &&
          (nextCategory === ALL_CATEGORIES || currentProduct.category === nextCategory);

        return {
          ...row,
          category: nextCategory,
          productId: keepCurrentProduct ? row.productId : "",
        };
      }),
    );
  };

  const onProductChange = (i: number, productId: string) => {
    const selectedProduct = state.products.find((product) => product.id === productId);
    updateRow(i, {
      productId,
      category: selectedProduct?.category ?? ALL_CATEGORIES,
    });
  };

  const addRows = () => {
    setRows((currentRows) => {
      const lastCategory = currentRows.at(-1)?.category ?? ALL_CATEGORIES;
      return [...currentRows, buildRow(lastCategory)];
    });
  };

  const removeRow = (i: number) =>
    setRows((currentRows) => currentRows.filter((_, idx) => idx !== i));

  const onPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetStockInForm = (nextInvoiceNumber = `INV-${1000 + state.stockIns.length + 1}`) => {
    setEditingInvoiceId(null);
    setFactoryId(state.factories[0]?.id ?? "");
    setInvoiceNumber(nextInvoiceNumber);
    setDate(new Date().toISOString().slice(0, 10));
    setRows([
      {
        category: firstProduct?.category ?? ALL_CATEGORIES,
        productId: firstProduct?.id ?? "",
        quantity: 0,
        buyPrice: 0,
      },
    ]);
    setPhoto(undefined);
  };

  const buildRowsFromInvoice = (invoice: StockInInvoice) =>
    invoice.items.map((item) => {
      const product = state.products.find((entry) => entry.id === item.productId);
      return {
        category: product?.category ?? ALL_CATEGORIES,
        productId: item.productId,
        quantity: item.quantity,
        buyPrice: item.buyPrice,
      };
    });

  const startEditingInvoice = (invoice: StockInInvoice) => {
    const hasMissingProducts = invoice.items.some(
      (item) => !state.products.some((product) => product.id === item.productId),
    );
    if (hasMissingProducts) {
      toast.error("This invoice has products that no longer exist, so it cannot be edited.");
      return;
    }

    setEditingInvoiceId(invoice.id);
    setFactoryId(invoice.factoryId);
    setInvoiceNumber(invoice.invoiceNumber);
    setDate(invoice.date);
    setRows(buildRowsFromInvoice(invoice));
    setPhoto(invoice.photo);
    setViewingInvoiceId(null);
    setMode("stock-in");
  };

  const submit = () => {
    if (!factoryId) {
      toast.error("Select a factory");
      return;
    }
    if (rows.some((r) => !r.productId || r.quantity <= 0 || r.buyPrice < 0)) {
      toast.error("Check item rows");
      return;
    }
    const payload = {
      invoiceNumber,
      factoryId,
      date,
      items: rows.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        buyPrice: row.buyPrice,
      })),
      photo,
    };

    if (editingInvoiceId) {
      const result = updateStockIn(editingInvoiceId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock-in invoice updated");
      resetStockInForm();
      setMode("history");
      return;
    }

    addStockIn(payload);
    toast.success("Stock-in recorded — stock and sale cost updated");
    resetStockInForm(`INV-${1000 + state.stockIns.length + 2}`);
  };

  return (
    <div>
      <PageHeader
        title="Stock In"
        description={
          mode === "stock-in"
            ? "Record purchases. Stock and sale cost update automatically from stock-in prices."
            : "Review saved stock-in invoices and uploaded invoice photos."
        }
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant={mode === "stock-in" ? "default" : "outline"}
              onClick={() => setMode("stock-in")}
            >
              Stock-In Mode
            </Button>
            <Button
              variant={mode === "history" ? "default" : "outline"}
              onClick={() => setMode("history")}
            >
              View Invoices
            </Button>
          </div>
        }
      />

      {mode === "stock-in" ? (
        <PageSection
          title={editingInvoiceId ? "Edit Stock-In Invoice" : "New Stock-In Invoice"}
          description={
            editingInvoiceId
              ? "Update the saved invoice items, price per unit, or photo, then save your changes."
              : undefined
          }
          actions={
            editingInvoiceId ? (
              <Button variant="outline" onClick={() => resetStockInForm()}>
                Cancel Edit
              </Button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <Label>Factory</Label>
              <Select value={factoryId} onValueChange={setFactoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {state.factories.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[1050px]">
              <thead className="bg-muted">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-16">No.</th>
                  <th className="px-3 py-2 font-medium w-48">Category</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium w-24">Qty</th>
                  <th className="px-3 py-2 font-medium w-28">Unit</th>
                  <th className="px-3 py-2 font-medium w-32">Price / Unit</th>
                  <th className="px-3 py-2 font-medium text-right w-28">Subtotal</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const productOptions = state.products.filter(
                    (product) =>
                      row.category === ALL_CATEGORIES || product.category === row.category,
                  );
                  const selectedProduct = state.products.find(
                    (product) => product.id === row.productId,
                  );
                  const selectedUnit = selectedProduct ? formatUnits(selectedProduct.unit) : "—";

                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.category}
                          onValueChange={(value) => onCategoryChange(i, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.productId}
                          onValueChange={(value) => onProductChange(i, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {productOptions.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={displayZeroAsPlaceholder(row.quantity)}
                          placeholder="0"
                          onChange={(e) =>
                            updateRow(i, { quantity: parseNumericInput(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          lang={selectedUnit !== "—" ? "km" : undefined}
                          className="khmer-ui-text text-sm font-semibold text-foreground"
                        >
                          {selectedUnit}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={displayZeroAsPlaceholder(row.buyPrice)}
                          placeholder="0"
                          onChange={(e) => updateRow(i, { buyPrice: parseNumericInput(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {fmtMoney(row.quantity * row.buyPrice)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {rows.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => removeRow(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td colSpan={6} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={addRows}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Rows
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Add one new row using the previous row setup to keep big invoices fast.
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{fmtMoney(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Category and unit fill from the selected product so stock-in is faster for big
            invoices. Subtotal = quantity x price per unit.
          </div>

          <div className="mt-4">
            <Label>Invoice Photo (optional)</Label>
            <div className="mt-1 w-full rounded-lg border-2 border-dashed border-border p-8 text-center">
              {photo ? (
                <div className="relative">
                  <img src={photo} alt="invoice" className="max-h-48 mx-auto rounded" />
                  <button
                    onClick={() => setPhoto(undefined)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center text-sm text-muted-foreground">
                  <Upload className="mb-1 h-6 w-6" />
                  Click to upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={submit} size="lg">
              {editingInvoiceId ? "Update Stock-In" : "Save Stock-In"}
            </Button>
          </div>
        </PageSection>
      ) : (
        <PageSection
          title="Stock-In History"
          description="Open saved invoices and review purchase totals."
        >
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Invoice</th>
                  <th className="px-5 py-2 font-medium">Factory</th>
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Items</th>
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                  <th className="px-5 py-2 font-medium">Photo</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.stockIns.map((si) => (
                  <tr key={si.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs">{si.invoiceNumber}</td>
                    <td className="px-5 py-2">
                      {state.factories.find((f) => f.id === si.factoryId)?.name ?? "—"}
                    </td>
                    <td className="px-5 py-2">{si.date}</td>
                    <td className="px-5 py-2 text-xs text-muted-foreground">
                      {si.items.length} item(s)
                    </td>
                    <td className="px-5 py-2 text-right font-medium">{fmtMoney(si.total)}</td>
                    <td className="px-5 py-2">
                      {si.photo ? (
                        <span className="text-xs text-muted-foreground">Attached</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingInvoiceId(si.id)}
                        >
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEditingInvoice(si)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      )}

      <StockInInvoiceDialog
        invoice={viewingInvoice}
        products={state.products}
        factories={state.factories}
        onClose={() => setViewingInvoiceId(null)}
        onEdit={startEditingInvoice}
      />
    </div>
  );
}

function StockInInvoiceDialog({
  invoice,
  products,
  factories,
  onClose,
  onEdit,
}: {
  invoice: StockInInvoice | null;
  products: Array<{ id: string; name: string; category: string; unit: unknown }>;
  factories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit: (invoice: StockInInvoice) => void;
}) {
  if (!invoice) return null;

  const factory = factories.find((item) => item.id === invoice.factoryId);

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Factory</p>
            <p className="font-medium">{factory?.name ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="font-medium">{invoice.date}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="font-medium">{invoice.items.length}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-medium">{fmtMoney(invoice.total)}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">No.</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Price / Unit</th>
                <th className="px-3 py-2 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => {
                const product = products.find((entry) => entry.id === item.productId);
                const productUnit = product ? formatUnits(product.unit) : "—";

                return (
                  <tr key={`${invoice.id}_${index}`} className="border-t border-border">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">{product?.name ?? "Deleted product"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{product?.category ?? "—"}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">
                      <span
                        lang={productUnit !== "—" ? "km" : undefined}
                        className="khmer-ui-text text-sm font-semibold text-foreground"
                      >
                        {productUnit}
                      </span>
                    </td>
                    <td className="px-3 py-2">{fmtMoney(item.buyPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {fmtMoney(item.quantity * item.buyPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {invoice.photo && (
          <div>
            <Label>Invoice Photo</Label>
            <img
              src={invoice.photo}
              alt={invoice.invoiceNumber}
              className="mt-2 max-h-[50vh] w-full rounded-lg border border-border object-contain"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onEdit(invoice)}>Edit Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
