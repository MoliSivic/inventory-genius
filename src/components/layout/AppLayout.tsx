import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
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
  ClipboardList,
  FileDown,
  Settings,
  Menu,
  X,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  type AppRole,
  getMockAuthUser,
  getSupabaseClient,
  getSupabaseUserProfile,
  getSupabaseUnavailableMessage,
  isMockAuthEnabled,
  MOCK_AUTH_STATE_CHANGED_EVENT,
  signOutMockAuth,
  isSupabaseReady,
} from "@/lib/supabase";
import { toast } from "sonner";

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
      { to: "/orders", label: "Buyer Orders", icon: ClipboardList },
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

function fallbackNameFromEmail(email: string | null) {
  if (!email) return null;
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function resolveDisplayName(name: unknown, email: string | null) {
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return fallbackNameFromEmail(email);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state, currentBuyer } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const isAuthPage = location.pathname.startsWith("/auth");
  const isBuyerPage = location.pathname.startsWith("/buyer");

  useEffect(() => {
    if (isSupabaseReady) {
      const supabase = getSupabaseClient();
      let isMounted = true;

      const syncSession = async (session: Session | null) => {
        const email = session?.user?.email ?? null;

        if (!isMounted) return;

        if (!session?.user) {
          setUserEmail(null);
          setUserName(null);
          setUserRole(null);
          setIsAuthResolved(true);
          return;
        }

        const profile = await getSupabaseUserProfile(session.user);

        if (!isMounted) return;

        const profileName =
          profile.fullName ??
          session.user.user_metadata?.full_name ??
          session.user.user_metadata?.name;

        setUserEmail(profile.email || email);
        setUserName(resolveDisplayName(profileName, profile.email || email));
        setUserRole(profile.role);
        setIsAuthResolved(true);
      };

      void supabase.auth.getSession().then(({ data }) => syncSession(data.session));

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        void syncSession(session);
      });

      return () => {
        isMounted = false;
        subscription.subscription.unsubscribe();
      };
    }

    if (isMockAuthEnabled) {
      const syncMockEmail = () => {
        const mockUser = getMockAuthUser();
        const email = mockUser?.email ?? null;

        setUserEmail(email);
        setUserName(resolveDisplayName(mockUser?.name, email));
        setUserRole(email ? "admin" : null);
        setIsAuthResolved(true);
      };

      syncMockEmail();
      window.addEventListener(MOCK_AUTH_STATE_CHANGED_EVENT, syncMockEmail);
      window.addEventListener("storage", syncMockEmail);

      return () => {
        window.removeEventListener(MOCK_AUTH_STATE_CHANGED_EVENT, syncMockEmail);
        window.removeEventListener("storage", syncMockEmail);
      };
    }

    setUserEmail(null);
    setUserName(null);
    setUserRole(null);
    setIsAuthResolved(true);
  }, []);

  useEffect(() => {
    if (!isAuthResolved) return;

    if (isBuyerPage) {
      if (userEmail && userRole === "admin") {
        void navigate({ to: "/", replace: true });
      }
      return;
    }

    if (isAuthPage && userEmail) {
      if (userRole === "admin") {
        void navigate({ to: "/", replace: true });
        return;
      }

      if (currentBuyer) {
        void navigate({ to: "/buyer/shop", replace: true });
        return;
      }

      void navigate({ to: "/buyer/shop", replace: true });
      return;
    }

    if (!isAuthPage && !userEmail) {
      void navigate({ to: "/auth", replace: true });
      return;
    }

    if (!isAuthPage && userEmail && userRole !== "admin") {
      if (currentBuyer) {
        void navigate({ to: "/buyer/shop", replace: true });
        return;
      }

      void navigate({ to: "/buyer/shop", replace: true });
    }
  }, [
    currentBuyer,
    isAuthPage,
    isAuthResolved,
    isBuyerPage,
    location.pathname,
    navigate,
    userEmail,
    userRole,
  ]);

  const handleSignOut = async () => {
    if (isMockAuthEnabled) {
      signOutMockAuth();
      setUserEmail(null);
      setUserName(null);
      setUserRole(null);
      toast.success("Logged out successfully.");
      await navigate({ to: "/auth" });
      return;
    }

    if (!isSupabaseReady) {
      toast.error(getSupabaseUnavailableMessage());
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    setUserEmail(null);
    setUserName(null);
    setUserRole(null);
    toast.success("Logged out successfully.");
    await navigate({ to: "/auth" });
  };

  if (isAuthPage) {
    return (
      <div className="min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }

  if (isBuyerPage) {
    return (
      <div className="min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }

  if (!isAuthResolved) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-background text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!userEmail) {
    return null;
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
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
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden lg:pl-64">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 shrink-0 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight sm:text-base">
              {navItems.find((n) =>
                n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to),
              )?.label ?? "Dashboard"}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden w-[220px] flex-col items-end leading-tight sm:flex">
                <span className="w-full truncate text-right text-xs font-semibold text-foreground">
                  {userName ?? "User"}
                </span>
                {userEmail && (
                  <span className="w-full truncate text-right text-[11px] text-muted-foreground">
                    {userEmail}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="w-[76px] shrink-0 px-0"
                onClick={handleSignOut}
              >
                Log Out
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col p-4 sm:p-6">
          <div className="w-full min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
