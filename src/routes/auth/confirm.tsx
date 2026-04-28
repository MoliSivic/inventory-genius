import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exchangeAuthSessionFromUrl,
  getAuthRedirectUrl,
  getSupabaseClient,
  getSupabaseUnavailableMessage,
  isSupabaseReady,
} from "@/lib/supabase";

export const Route = createFileRoute("/auth/confirm")({ component: ConfirmAccountPage });

type ConfirmState = "checking" | "confirmed" | "missing" | "error";

function ConfirmAccountPage() {
  const navigate = Route.useNavigate();
  const [confirmState, setConfirmState] = useState<ConfirmState>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!isSupabaseReady) {
        if (!active) return;
        setConfirmState("error");
        setErrorMessage(getSupabaseUnavailableMessage());
        return;
      }

      const result = await exchangeAuthSessionFromUrl();
      if (!active) return;

      if (result.status === "error") {
        setConfirmState("error");
        setErrorMessage(result.message);
        return;
      }

      if (result.status === "none") {
        setConfirmState("missing");
        return;
      }

      if (result.flow === "otp" && result.otpType === "recovery") {
        await navigate({ to: "/auth/reset-password" });
        return;
      }

      setConfirmState("confirmed");
      toast.success("Email verified successfully.");
    };

    void verify();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = resendEmail.trim();
    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!isSupabaseReady) {
      setErrorMessage(getSupabaseUnavailableMessage());
      return;
    }

    setIsResending(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/auth/confirm"),
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      toast.success("A new confirmation email has been sent.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPageFrame
      title="Confirm Account"
      description="Verify your email to activate your account."
      footer={
        <p className="pt-2 text-center text-sm text-muted-foreground">
          Back to{" "}
          <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Confirmation Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {confirmState === "checking" && (
        <Alert>
          <AlertTitle>Verifying</AlertTitle>
          <AlertDescription>We are validating your confirmation link.</AlertDescription>
        </Alert>
      )}

      {confirmState === "confirmed" && (
        <div className="space-y-3">
          <Alert>
            <AlertTitle>Email Confirmed</AlertTitle>
            <AlertDescription>Your account is verified. You can now sign in.</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link to="/auth">Go to Sign In</Link>
          </Button>
        </div>
      )}

      {(confirmState === "missing" || confirmState === "error") && (
        <form onSubmit={handleResend} className="space-y-3">
          <Alert>
            <AlertTitle>Need A New Confirmation Link?</AlertTitle>
            <AlertDescription>
              Enter your email and we will resend the account confirmation message.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-resend-email">Email</Label>
            <Input
              id="confirm-resend-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={!isSupabaseReady || isResending}>
            {isResending ? "Sending..." : "Resend Confirmation Email"}
          </Button>
        </form>
      )}
    </AuthPageFrame>
  );
}
