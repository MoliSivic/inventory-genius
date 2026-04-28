import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/buyer/")({
  component: BuyerEntryRedirect,
});

function BuyerEntryRedirect() {
  const { currentBuyer } = useStore();
  const navigate = Route.useNavigate();

  useEffect(() => {
    void navigate({ to: currentBuyer ? "/buyer/shop" : "/auth", replace: true });
  }, [currentBuyer, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      Redirecting...
    </div>
  );
}
