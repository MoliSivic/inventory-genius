import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/buyer/sign-up")({
  component: LegacyBuyerSignUpRedirect,
});

function LegacyBuyerSignUpRedirect() {
  const { currentBuyer } = useStore();
  const navigate = Route.useNavigate();

  useEffect(() => {
    if (currentBuyer) {
      void navigate({ to: "/buyer/shop", replace: true });
      return;
    }

    void navigate({ to: "/auth/sign-up", replace: true });
  }, [currentBuyer, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      Redirecting...
    </div>
  );
}
