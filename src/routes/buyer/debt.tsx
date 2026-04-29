import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ReceiptText, WalletCards } from "lucide-react";
import { StatusBadge } from "@/components/app/StatCard";
import { fmtMoney, formatUnits, useStore } from "@/lib/store";

export const Route = createFileRoute("/buyer/debt")({
  component: BuyerDebtPage,
});

function BuyerDebtPage() {
  const { state, currentBuyer } = useStore();
  const customerId = currentBuyer?.customerId;
  const invoices = state.sales
    .filter((sale) => sale.customerId === customerId)
    .sort((left, right) => right.date.localeCompare(left.date));
  const debtInvoices = invoices.filter((sale) => sale.total - sale.paidAmount > 0.005);
  const totalDebt = debtInvoices.reduce((sum, sale) => sum + sale.total - sale.paidAmount, 0);
  const payments = state.payments
    .filter((payment) => payment.customerId === customerId)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Debt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Balance from unpaid and partial invoices
        </p>
      </div>

      <section className="mb-4 rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive">
            <WalletCards className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Outstanding balance</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-destructive">
              {fmtMoney(totalDebt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {debtInvoices.length} invoice{debtInvoices.length === 1 ? "" : "s"} still open
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Open Invoices</h2>
            <span className="text-xs text-muted-foreground">{debtInvoices.length} open</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {debtInvoices.map((sale) => {
              const balance = Math.max(sale.total - sale.paidAmount, 0);

              return (
                <article
                  key={sale.id}
                  className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{sale.receiptNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(sale.date).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={sale.paymentStatus} />
                  </div>

                  <div className="mt-3 space-y-2">
                    {sale.items.map((item) => {
                      const product = state.products.find(
                        (candidate) => candidate.id === item.productId,
                      );

                      return (
                        <div
                          key={`${sale.id}-${item.productId}`}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-medium">{product?.name ?? "Product"}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {formatUnits(item.unit)}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold">
                            {fmtMoney(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-sm">
                    <MoneyCell label="Total" value={sale.total} />
                    <MoneyCell label="Paid" value={sale.paidAmount} />
                    <MoneyCell label="Need pay" value={balance} danger />
                  </div>
                </article>
              );
            })}

            {debtInvoices.length === 0 && (
              <div className="rounded-md border border-border bg-card p-8 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
                <p className="mt-3 text-sm font-medium">No debt right now</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid invoices will stay in the invoice page.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Recent Payments</h2>
            <span className="text-xs text-muted-foreground">{payments.length} shown</span>
          </div>

          <div className="space-y-3">
            {payments.map((payment) => {
              const sale = state.sales.find((candidate) => candidate.id === payment.saleId);

              return (
                <article
                  key={payment.id}
                  className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success/15 text-success">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-success">{fmtMoney(payment.amount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString()}
                      </p>
                      {sale && (
                        <p className="mt-1 truncate font-mono text-xs">{sale.receiptNumber}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {payments.length === 0 && (
              <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MoneyCell({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={danger ? "mt-1 truncate font-bold text-destructive" : "mt-1 truncate font-bold"}
      >
        {fmtMoney(value)}
      </p>
    </div>
  );
}
