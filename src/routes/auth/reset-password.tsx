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
  getSupabaseClient,
  getSupabaseUnavailableMessage,
  isSupabaseReady,
} from "@/lib/supabase";

export const Route = createFileRoute("/auth/reset-password")({ component: ResetPasswordPage });

type ResetFlowState = "checking" | "ready" | "done" | "error";

function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [flowState, setFlowState] = useState<ResetFlowState>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!isSupabaseReady) {
        if (!active) return;
        setFlowState("error");
        setErrorMessage(getSupabaseUnavailableMessage());
        return;
      }

      const exchangeResult = await exchangeAuthSessionFromUrl();
      if (!active) return;

      if (exchangeResult.status === "error") {
        setFlowState("error");
        setErrorMessage(exchangeResult.message);
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        setFlowState("error");
        setErrorMessage("This reset link is invalid or expired. Request a new reset link.");
        return;
      }

      setFlowState("ready");
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!isSupabaseReady) {
      setErrorMessage(getSupabaseUnavailableMessage());
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await supabase.auth.signOut();
      setFlowState("done");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated. Please sign in with your new password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageFrame
      title="Reset Password"
      description="Create a new password for your account."
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
          <AlertTitle>Reset Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {flowState === "checking" && (
        <Alert>
          <AlertTitle>Checking Reset Link</AlertTitle>
          <AlertDescription>Please wait while we validate your reset session.</AlertDescription>
        </Alert>
      )}

      {flowState === "done" && (
        <Alert>
          <AlertTitle>Password Updated</AlertTitle>
          <AlertDescription>Your password has been changed successfully.</AlertDescription>
        </Alert>
      )}

      {flowState === "error" && (
        <div className="space-y-3">
          <Button asChild className="w-full" variant="outline">
            <Link to="/auth/forgot-password">Request New Reset Link</Link>
          </Button>
        </div>
      )}

      {flowState === "ready" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-new">New Password</Label>
            <Input
              id="reset-password-new"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-password-confirm">Confirm Password</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={!isSupabaseReady || isSubmitting}>
            {isSubmitting ? "Updating password..." : "Update Password"}
          </Button>
        </form>
      )}
    </AuthPageFrame>
  );
}
