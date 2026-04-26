import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useStore, fmtMoney } from "@/lib/store";
import { PageHeader, PageSection } from "@/components/app/StatCard";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Factory } from "@/lib/types";

export const Route = createFileRoute("/factories")({ component: FactoriesPage });

function FactoriesPage() {
  const { state, upsertFactory, deleteFactory } = useStore();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Factory | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Factory | null>(null);

  const filtered = state.factories.filter(
    (f) =>
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Factories / Suppliers"
        description="Track suppliers and their purchase history."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Factory
          </Button>
        }
      />
      <PageSection>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search factories..."
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => {
            const purchases = state.stockIns.filter((s) => s.factoryId === f.id);
            const total = purchases.reduce((a, s) => a + s.total, 0);
            return (
              <div
                key={f.id}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.location}</p>
                  </div>
                  <div className="flex">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(f);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete ${f.name}?`)) {
                          deleteFactory(f.id);
                          toast.success("Deleted");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{f.phone}</p>
                <div className="mt-2 min-h-[1.25rem] text-xs italic text-muted-foreground">
                  {f.notes ? <p>"{f.notes}"</p> : <span className="invisible">No note</span>}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Purchases</p>
                    <p className="font-semibold">
                      {purchases.length} · {fmtMoney(total)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setViewing(f)}>
                    History
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No factories.</p>
        )}
      </PageSection>

      <FactoryDialog
        open={open}
        onClose={() => setOpen(false)}
        factory={editing}
        onSave={(f) => {
          upsertFactory(f);
          toast.success(editing ? "Updated" : "Added");
          setOpen(false);
        }}
      />
      <FactoryHistoryDialog factory={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function FactoryDialog({
  open,
  onClose,
  factory,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  factory: Factory | null;
  onSave: (f: Omit<Factory, "id"> & { id?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setName(factory?.name ?? "");
    setPhone(factory?.phone ?? "");
    setLocation(factory?.location ?? "");
    setNotes(factory?.notes ?? "");
  }, [factory, open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{factory ? "Edit Factory" : "New Factory"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
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
                id: factory?.id,
                name: name.trim(),
                phone,
                location,
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

function FactoryHistoryDialog({
  factory,
  onClose,
}: {
  factory: Factory | null;
  onClose: () => void;
}) {
  const { state } = useStore();
  const purchases = useMemo(
    () => (factory ? state.stockIns.filter((s) => s.factoryId === factory.id) : []),
    [factory, state.stockIns],
  );
  const productName = (id: string) => state.products.find((p) => p.id === id)?.name ?? "—";
  return (
    <Dialog open={!!factory} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{factory?.name} — Purchase History</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {purchases.length === 0 && (
            <p className="text-muted-foreground text-sm">No purchases yet.</p>
          )}
          {purchases.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="font-mono">{p.invoiceNumber}</span>
                <span className="text-muted-foreground">{p.date}</span>
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                {p.items.map((it, i) => (
                  <li key={i}>
                    {productName(it.productId)} — {it.quantity} × {fmtMoney(it.buyPrice)} / unit
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-semibold text-right">Total: {fmtMoney(p.total)}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
