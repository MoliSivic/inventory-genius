import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  Factory,
  Users,
  PackagePlus,
  ShoppingCart,
  Tag,
  TrendingUp,
  Wallet,
  FileDown,
  Settings,
  Menu,
  X,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = {
  title: string;
  description: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    description: "Start here",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Inventory",
    description: "Products and stock",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/factories", label: "Factories", icon: Factory },
      { to: "/stock-in", label: "Stock In", icon: PackagePlus },
    ],
  },
  {
    title: "Sales",
    description: "Customers and pricing",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/sales", label: "Sales", icon: ShoppingCart },
      { to: "/customer-prices", label: "Customer Prices", icon: Tag },
    ],
  },
  {
    title: "Finance",
    description: "Reports and debt",
    items: [
      { to: "/reports", label: "Profit Reports", icon: TrendingUp },
      { to: "/debts", label: "Debt Tracking", icon: Wallet },
      { to: "/exports", label: "Exports", icon: FileDown },
    ],
  },
  {
    title: "System",
    description: "App settings",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state } = useStore();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Boxes className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{state.shopName}</p>
            <p className="text-xs text-sidebar-foreground/60">Warehouse System</p>
          </div>
          <button
            className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <div className="px-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                  {group.title}
                </p>
                <p className="text-[10px] text-sidebar-foreground/40">{group.description}</p>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      to={item.to as never}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
          v1.0 · Mock prototype
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
            <button
              className="lg:hidden p-2 -ml-2 rounded hover:bg-muted"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight">
              {navItems.find((n) =>
                n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to),
              )?.label ?? "Dashboard"}
            </h1>
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              Owner / Admin
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}