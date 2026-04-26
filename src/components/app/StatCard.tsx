import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const toneMap: Record<string, string> = {
    default: "bg-muted text-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    primary: "bg-primary/15 text-primary",
  };
  return (
    <div className="rounded-xl bg-card border border-border p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight truncate">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            toneMap[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card border border-border shadow-[var(--shadow-card)]">
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: "paid" | "unpaid" | "partial" }) {
  const map = {
    paid: "bg-success/15 text-success",
    unpaid: "bg-destructive/15 text-destructive",
    partial: "bg-warning/25 text-warning-foreground",
  } as const;
  const label = { paid: "Paid", unpaid: "Unpaid", partial: "Partial" }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        map[status],
      )}
    >
      {label}
    </span>
  );
}

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  const low = stock <= min;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        low ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success",
      )}
    >
      {low ? "Low Stock" : "In Stock"}
    </span>
  );
}