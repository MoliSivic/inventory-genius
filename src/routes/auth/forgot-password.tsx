import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAuthRedirectUrl,
  getSupabaseClient,
  getSupabaseUnavailableMessage,
  isSupabaseReady,
} from "@/lib/supabase";

export const Route = createFileRoute("/auth/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!isSupabaseReady) {
      setErrorMessage(getSupabaseUnavailableMessage());
      return;
    }

    setIsSending(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl("/auth/reset-password"),
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setIsSent(true);
      toast.success("Password reset email sent.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AuthPageFrame
      title="Forgot Password"
      description="Enter your account email and we will send you a reset link."
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

      {isSent && (
        <Alert>
          <AlertTitle>Check Your Email</AlertTitle>
          <AlertDescription>
            If this email is registered, a password reset link has been sent.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-password-email">Email</Label>
          <Input
            id="forgot-password-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={!isSupabaseReady || isSending}>
          {isSending ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
    </AuthPageFrame>
  );
}
