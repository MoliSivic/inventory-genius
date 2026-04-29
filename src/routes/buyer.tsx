import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  Boxes,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Settings,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { getSupabaseClient, getSupabaseUserProfile, isSupabaseReady } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buyer")({
  component: BuyerLayout,
});

function BuyerLayout() {
  const { state, currentBuyer, signInBuyerByEmail, signOutBuyer } = useStore();
  const navigate = Route.useNavigate();
  const location = useLocation();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [isSupabaseAuthResolved, setIsSupabaseAuthResolved] = useState(!isSupabaseReady);
  const isLegacyEntryPage =
    location.pathname === "/buyer" || location.pathname === "/buyer/sign-up";

  useEffect(() => {
    if (!isSupabaseReady) return;

    const supabase = getSupabaseClient();
    let isMounted = true;

    const syncSession = async (session: Session | null) => {
      if (!isMounted) return;

      if (!session?.user) {
        setAuthEmail(null);
        setAuthName(null);
        setIsSupabaseAuthResolved(true);
        return;
      }

      const profile = await getSupabaseUserProfile(session.user);
      if (!isMounted) return;

      const metadataName =
        session.user.user_metadata?.full_name ?? session.user.user_metadata?.name;
      const profileName =
        profile.fullName ??
        (typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : null);

      setAuthEmail(profile.email || session.user.email || null);
      setAuthName(profileName);
      setIsSupabaseAuthResolved(true);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseAuthResolved) return;

    const normalizedAuthEmail = authEmail?.trim().toLocaleLowerCase() ?? null;
    const isDifferentCustomer =
      normalizedAuthEmail && currentBuyer?.email.trim().toLocaleLowerCase() !== normalizedAuthEmail;

    if (isSupabaseReady && !normalizedAuthEmail) {
      signOutBuyer();
      void navigate({ to: "/auth", replace: true });
      return;
    }

    if (normalizedAuthEmail && (!currentBuyer || isDifferentCustomer)) {
      const result = signInBuyerByEmail(authEmail, authName);

      if (result.ok) return;

      void navigate({ to: "/auth", replace: true });
      return;
    }

    if (!currentBuyer) {
      void navigate({ to: "/auth", replace: true });
      return;
    }

    if (currentBuyer && isLegacyEntryPage) {
      void navigate({ to: "/buyer/shop", replace: true });
    }
  }, [
    authEmail,
    authName,
    currentBuyer,
    isSupabaseAuthResolved,
    isLegacyEntryPage,
    location.pathname,
    navigate,
    signInBuyerByEmail,
    signOutBuyer,
  ]);

  const handleSignOut = async () => {
    signOutBuyer();

    if (isSupabaseReady && authEmail) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await navigate({ to: "/auth" });
      return;
    }

    await navigate({ to: "/auth" });
  };

  const buyerOrders = state.buyerOrders.filter((order) => order.buyerId === currentBuyer?.id);
  const openOrderCount = buyerOrders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  ).length;
  const buyerInvoices = state.sales.filter((sale) => sale.customerId === currentBuyer?.customerId);
  const activeInvoiceCount = buyerInvoices.filter((sale) => !sale.archivedAt).length;
  const debtInvoiceCount = buyerInvoices.filter(
    (sale) => sale.total - sale.paidAmount > 0.005,
  ).length;
  const navItems = [
    { to: "/buyer/shop", label: "Order", icon: ShoppingBag, badge: 0 },
    { to: "/buyer/orders", label: "Orders", icon: PackageCheck, badge: openOrderCount },
    { to: "/buyer/invoices", label: "Invoices", icon: ReceiptText, badge: activeInvoiceCount },
    { to: "/buyer/debt", label: "Debt", icon: WalletCards, badge: debtInvoiceCount },
    { to: "/buyer/settings", label: "Settings", icon: Settings, badge: 0 },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col bg-background">
        {currentBuyer && (
          <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-3 sm:h-16 sm:px-6 lg:px-8">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  className="flex w-[min(20rem,calc(100vw-2rem))] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                  side="left"
                >
                  <SheetHeader className="border-b border-sidebar-border px-5 py-5 pr-10 text-left">
                    <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                        <Boxes className="h-5 w-5 text-sidebar-primary-foreground" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {state.shopName}
                        </span>
                        <span className="block text-xs font-normal text-sidebar-foreground/55">
                          Customer Portal
                        </span>
                      </span>
                    </SheetTitle>
                    <SheetDescription className="text-sidebar-foreground/60">
                      {currentBuyer.name} - {currentBuyer.market || "Set market"}
                    </SheetDescription>
                  </SheetHeader>

                  <nav className="space-y-5 px-3 py-4">
                    <section className="space-y-2">
                      <div className="px-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                          Menu
                        </p>
                        <p className="text-[10px] text-sidebar-foreground/40">Customer actions</p>
                      </div>
                      <div className="space-y-1">
                        {navItems.map((item) => {
                          const Icon = item.icon;
                          const active = location.pathname === item.to;

                          return (
                            <SheetClose key={item.to} asChild>
                              <Link
                                to={item.to}
                                className={cn(
                                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.badge > 0 && (
                                  <span
                                    className={cn(
                                      "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
                                      active
                                        ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground ring-1 ring-sidebar-primary-foreground/25"
                                        : "bg-warning/95 text-warning-foreground shadow-sm",
                                    )}
                                  >
                                    {item.badge > 99 ? "99+" : item.badge}
                                  </span>
                                )}
                              </Link>
                            </SheetClose>
                          );
                        })}
                      </div>
                    </section>
                  </nav>

                  <div className="mt-auto border-t border-sidebar-border px-5 py-4">
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        onClick={() => void handleSignOut()}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
              <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                  <Boxes className="h-5 w-5 text-sidebar-primary-foreground" />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold">{state.shopName}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate font-medium text-foreground/80">
                      {currentBuyer.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground/60">·</span>
                    <span className="truncate">{currentBuyer.market || "Set market"}</span>
                  </div>
                </div>
              </div>
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary md:flex">
                <Boxes className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div className="hidden min-w-0 flex-1 md:block">
                <p className="truncate text-sm font-semibold">{state.shopName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {currentBuyer.name} · {currentBuyer.market || "Set market"}
                </p>
              </div>
              <nav className="hidden items-center gap-1 md:flex">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.to;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      {item.badge > 0 && (
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
                            active
                              ? "bg-background text-foreground"
                              : "bg-warning/95 text-warning-foreground",
                          )}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label="Sign out"
                onClick={() => void handleSignOut()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
        )}

        <main className={cn("flex-1", currentBuyer ? "pb-6 pt-16" : "")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
