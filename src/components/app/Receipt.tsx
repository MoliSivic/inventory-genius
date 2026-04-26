import { fmtMoney } from "@/lib/store";
import { normalizeSaleUnit } from "@/lib/sale-units";
import type { Customer, Sale, Product } from "@/lib/types";
import { Phone, MapPin, CheckCircle2, Clock } from "lucide-react";

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
  const remaining = sale.total - sale.paidAmount;
  const isPaid = remaining <= 0;

  return (
    <div
      id="receipt-printable"
      className="relative mx-auto w-full max-w-4xl bg-white text-slate-900 overflow-hidden sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-slate-200"
    >
      {/* ─── HEADER ─── */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 sm:px-8 pt-8 pb-10 text-white">
        {/* Decorative accent line at the very top */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

        <div className="flex flex-col sm:flex-row justify-between gap-6">
          {/* Left: shop name + label */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{shopName}</h2>
            <p className="mt-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Sales Receipt
            </p>
          </div>

          {/* Right: receipt # + date */}
          <div className="flex gap-6 sm:gap-10 text-left sm:text-right">
            <div>
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Receipt No.
              </p>
              <p className="mt-0.5 font-mono text-base sm:text-lg font-bold">{sale.receiptNumber}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                Date
              </p>
              <p className="mt-0.5 font-mono text-base sm:text-lg font-bold">{sale.date}</p>
            </div>
          </div>
        </div>

        {/* Customer info row inside header */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-5 border-t border-white/10">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
              Billed to
            </p>
            <p className="mt-1 text-sm sm:text-base font-bold">{customer?.name ?? "Walk-in customer"}</p>
            {customer && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-white/60">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </span>
                )}
                {customer.market && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    {customer.market}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Payment status badge */}
          <span
            className={`self-start sm:self-auto rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
              isPaid
                ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30"
                : sale.paidAmount > 0
                ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30"
                : "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/30"
            }`}
          >
            {isPaid ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Paid
              </span>
            ) : sale.paidAmount > 0 ? (
              "Partial"
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Unpaid
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ─── TABLE ─── */}
      <div className="px-6 sm:px-8 pt-6 sm:pt-8">
        {sale.notes && (
          <div className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800 ring-1 ring-amber-200/60">
            <span className="font-semibold">Note:</span> {sale.notes}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-[10px] sm:text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">NO.</th>
                <th className="px-4 py-3 border-b border-slate-200">PRODUCT</th>
                <th className="px-4 py-3 border-b border-slate-200">CATEGORY</th>
                <th className="px-4 py-3 border-b border-slate-200">QTY</th>
                <th className="px-4 py-3 border-b border-slate-200">UNIT</th>
                <th className="px-4 py-3 border-b border-slate-200">PRICE / UNIT</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((it, i) => {
                const product = getProduct(it.productId);
                return (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">{product?.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-500">{product?.category ?? "—"}</td>
                    <td className="px-4 py-3.5 text-slate-900 font-semibold">{it.quantity}</td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {normalizeSaleUnit(product ?? { name: "", unit: ["បេ"], category: "", id: "", stock: 0, avgCost: 0, totalCostBasis: 0, costLayers: [], minStock: 0, variants: [] }, it.unit)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-900">{fmtMoney(it.unitPrice)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                      {fmtMoney(it.unitPrice * it.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── FOOTER / TOTALS ─── */}
      <div className="px-6 sm:px-8 pt-6 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Left: payment method / extra info placeholder */}
          <div className="hidden sm:block" />

          {/* Right: totals summary */}
          <div className="w-full sm:w-80">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({sale.items.length} {sale.items.length === 1 ? "item" : "items"})</span>
                <span className="font-medium text-slate-900">{fmtMoney(sale.total)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Paid</span>
                <span className="font-medium text-slate-900">{fmtMoney(sale.paidAmount)}</span>
              </div>

              {remaining > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Balance due</span>
                  <span className="font-semibold">{fmtMoney(remaining)}</span>
                </div>
              )}
            </div>

            {/* Grand total bar */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white">
              <span className="text-xs font-bold uppercase tracking-wider">Total</span>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight">{fmtMoney(sale.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── THANK YOU STRIP ─── */}
      <div className="mt-8 bg-slate-50 border-t border-slate-200 px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <p className="text-sm font-bold text-slate-800">Thank you for your purchase!</p>
          <p className="mt-0.5 text-xs text-slate-500">
            We truly appreciate your business. If you have any questions, please don't hesitate to contact us.
          </p>
        </div>
        <p className="shrink-0 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400">
          {shopName}
        </p>
      </div>

      {/* Bottom accent stripe matching the top */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
    </div>
  );
}
