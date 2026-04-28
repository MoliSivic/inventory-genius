import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, User } from "lucide-react";
import { useStore, fmtMoney, customerTotals } from "@/lib/store";
import { normalizeMarkets, sameMarketName } from "@/lib/markets";
import { getTelegramUrl } from "@/lib/telegram";
import { PageHeader, PageSection, StatusBadge } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Customer } from "@/lib/types";

export const Route = createFileRoute("/customers")({ component: CustomersPage });

type MarketMutationResult = { ok: true } | { ok: false; error: string };

function CustomersPage() {
  const { state, addMarket, updateMarket, deleteMarket, upsertCustomer, deleteCustomer } =
    useStore();
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("all");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);

  const markets = useMemo(
    () => normalizeMarkets(state.markets, state.customers),
    [state.markets, state.customers],
  );

  useEffect(() => {
    if (market === "all") return;
    if (!markets.some((item) => sameMarketName(item, market))) setMarket("all");
  }, [market, markets]);

  const filtered = state.customers.filter((c) => {
    if (market !== "all" && !sameMarketName(c.market, market)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const onAddMarket = (name: string): MarketMutationResult => {
    const result = addMarket(name);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  const onUpdateMarket = (currentName: string, nextName: string): MarketMutationResult => {
    const result = updateMarket(currentName, nextName);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  const onDeleteMarket = (name: string): MarketMutationResult => {
    const result = deleteMarket(name);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer profiles, self-selected markets, sales totals, and debts."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setMarketOpen(true)}>
              Manage Markets
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Customer
            </Button>
          </div>
        }
      />
      <PageSection>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              {markets.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-5 py-2 font-medium">Market</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Telegram</th>
                <th className="px-5 py-2 font-medium text-right">Total Sales</th>
                <th className="px-5 py-2 font-medium text-right">Est. Profit</th>
                <th className="px-5 py-2 font-medium text-right">Debt</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const t = customerTotals(state, c.id);
                const hasTelegram = !!getTelegramUrl(c.telegram);
                return (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </td>
                    <td className="px-5 py-3">{c.market}</td>
                    <td className="px-5 py-3 text-xs">{c.type}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium ${hasTelegram ? "text-success" : "text-muted-foreground"}`}
                      >
                        {hasTelegram ? "Ready" : "Not set"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">{fmtMoney(t.totalSales)}</td>
                    <td className="px-5 py-3 text-right text-success">{fmtMoney(t.totalProfit)}</td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${t.debt > 0 ? "text-destructive" : ""}`}
                    >
                      {fmtMoney(t.debt)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(c)}>
                        <User className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${c.name}?`)) {
                            deleteCustomer(c.id);
                            toast.success("Deleted");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                    No customers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
      <CustomerDialog
        open={open}
        onClose={() => setOpen(false)}
        customer={editing}
        onSave={(c) => {
          upsertCustomer(c);
          toast.success(editing ? "Updated" : "Added");
          setOpen(false);
        }}
      />
      <MarketManagerDialog
        open={marketOpen}
        onClose={() => setMarketOpen(false)}
        markets={markets}
        customers={state.customers}
        onAddMarket={onAddMarket}
        onUpdateMarket={onUpdateMarket}
        onDeleteMarket={onDeleteMarket}
      />
      <CustomerProfileDialog customer={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function MarketManagerDialog({
  open,
  onClose,
  markets,
  customers,
  onAddMarket,
  onUpdateMarket,
  onDeleteMarket,
}: {
  open: boolean;
  onClose: () => void;
  markets: string[];
  customers: Customer[];
  onAddMarket: (name: string) => MarketMutationResult;
  onUpdateMarket: (currentName: string, nextName: string) => MarketMutationResult;
  onDeleteMarket: (name: string) => MarketMutationResult;
}) {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    if (open) return;
    setName("");
    setEditingName(null);
    setEditingValue("");
  }, [open]);

  const saveNewMarket = () => {
    const result = onAddMarket(name);
    if (!result.ok) return;
    toast.success("Market added");
    setName("");
  };

  const saveEdit = () => {
    if (!editingName) return;
    const result = onUpdateMarket(editingName, editingValue);
    if (!result.ok) return;
    toast.success("Market updated");
    setEditingName(null);
    setEditingValue("");
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Markets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <Label>Add Market Location</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Create delivery market locations. Customer app users choose their own market from
                this list.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Market name"
              />
              <Button onClick={saveNewMarket}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {markets.map((item) => {
              const customerCount = customers.filter((customer) =>
                sameMarketName(customer.market, item),
              ).length;
              const isEditing = !!editingName && sameMarketName(editingName, item);

              if (isEditing) {
                return (
                  <div key={item} className="rounded-lg border border-border p-3 space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditingName(null)}>
                        Cancel
                      </Button>
                      <Button onClick={saveEdit}>Save</Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item}
                  className="rounded-lg border border-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item}</p>
                    <p className="text-xs text-muted-foreground">{customerCount} customer(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingName(item);
                        setEditingValue(item);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!confirm(`Delete market "${item}"?`)) return;
                        const result = onDeleteMarket(item);
                        if (!result.ok) return;
                        toast.success(
                          customerCount > 0
                            ? 'Market deleted. Customers moved to "ផ្សេងៗ".'
                            : "Market deleted",
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialog({
  open,
  onClose,
  customer,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (c: Omit<Customer, "id"> & { id?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [type, setType] = useState("Retailer");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setTelegram(customer?.telegram ?? "");
    setType(customer?.type ?? "Retailer");
    setNotes(customer?.notes ?? "");
  }, [customer, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Telegram For Digital Receipt</Label>
              <Input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username or https://t.me/username"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use the customer&apos;s Telegram username or link so receipts can open and send faster.
          </p>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Market is controlled by the customer in their customer app settings.
            {customer?.market ? (
              <span className="mt-1 block font-medium text-foreground">
                Current market: {customer.market}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retailer">Retailer</SelectItem>
                  <SelectItem value="Wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Name required");
                return;
              }
              onSave({
                id: customer?.id,
                name: name.trim(),
                phone,
                market: customer?.market ?? "",
                telegram: telegram.trim() || undefined,
                type,
                notes: notes || undefined,
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerProfileDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const { state } = useStore();
  if (!customer) return null;
  const sales = state.sales.filter((s) => s.customerId === customer.id);
  const payments = state.payments.filter((p) => p.customerId === customer.id);
  const t = customerTotals(state, customer.id);
  const telegramUrl = getTelegramUrl(customer.telegram);
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="font-bold">{fmtMoney(t.totalSales)}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-3">
            <p className="text-xs text-muted-foreground">Est. Profit</p>
            <p className="font-bold text-success">{fmtMoney(t.totalProfit)}</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3">
            <p className="text-xs text-muted-foreground">Debt</p>
            <p className="font-bold text-destructive">{fmtMoney(t.debt)}</p>
          </div>
        </div>
        {customer.telegram && (
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!telegramUrl) {
                  toast.error("Customer Telegram username or link is invalid");
                  return;
                }
                window.open(telegramUrl, "_blank", "noopener,noreferrer");
              }}
            >
              Open Customer Telegram
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto">
          <div>
            <h4 className="text-sm font-semibold mb-2">Sales History</h4>
            <div className="space-y-1.5">
              {sales.length === 0 && <p className="text-xs text-muted-foreground">No sales</p>}
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="text-xs border border-border rounded p-2 flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono">{s.receiptNumber}</p>
                    <p className="text-muted-foreground">{s.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmtMoney(s.total)}</p>
                    <StatusBadge status={s.paymentStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Payments</h4>
            <div className="space-y-1.5">
              {payments.length === 0 && (
                <p className="text-xs text-muted-foreground">No payments</p>
              )}
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="text-xs border border-border rounded p-2 flex justify-between"
                >
                  <span>{p.date}</span>
                  <span className="font-semibold text-success">{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
