import { fmtMoney } from "@/lib/store";
import { normalizeSaleUnit } from "@/lib/sale-units";
import type { Customer, Sale, Product } from "@/lib/types";

const receiptStatusLabels: Record<Sale["paymentStatus"], string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

const receiptStatusClasses: Record<Sale["paymentStatus"], string> = {
  paid: "bg-success/15 text-success",
  partial: "bg-warning/20 text-warning-foreground",
  unpaid: "bg-destructive/15 text-destructive",
};

const fallbackProduct: Product = {
  id: "",
  name: "",
  category: "",
  unit: ["បេ"],
  stock: 0,
  avgCost: 0,
  totalCostBasis: 0,
  costLayers: [],
  minStock: 0,
  variants: [],
};

export function Receipt({
  sale,
  customer,
  products,
  shopName,
}: {
  sale: Sale;
  customer?: Customer;
  products: Product[];
  shopName: string;
}) {
  const getProduct = (id: string) => products.find((p) => p.id === id);

  return (
    <div
      id="receipt-printable"
      className="mx-auto w-full max-w-none rounded-md border border-border bg-background p-4 text-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{sale.receiptNumber}</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${receiptStatusClasses[sale.paymentStatus]}`}
            >
              {receiptStatusLabels[sale.paymentStatus]}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {customer?.name ?? "Walk-in customer"}
            {customer?.market ? ` - ${customer.market}` : ""}
          </p>
          {customer?.phone && (
            <p className="mt-1 text-xs text-muted-foreground">{customer.phone}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{sale.date}</p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {shopName}
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium text-right">Qty</th>
              <th className="py-2 pr-4 font-medium text-right">Price</th>
              <th className="py-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => {
              const product = getProduct(item.productId);
              const unit = normalizeSaleUnit(product ?? fallbackProduct, item.unit);
              return (
                <tr key={`${item.productId}-${index}`} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{product?.name ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">{product?.category ?? ""}</p>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {item.quantity} {unit}
                  </td>
                  <td className="py-3 pr-4 text-right">{fmtMoney(item.unitPrice)}</td>
                  <td className="py-3 text-right font-medium">
                    {fmtMoney(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground">
          {sale.notes ? <span>Note: {sale.notes}</span> : <span>No note</span>}
        </div>
        <div className="font-bold">
          Total: <span>{fmtMoney(sale.total)}</span>
        </div>
      </div>
    </div>
  );
}
