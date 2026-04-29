import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSupabaseClient,
  getSupabaseUserProfile,
  getSupabaseUnavailableMessage,
  isSupabaseReady,
} from "@/lib/supabase";

export const Route = createFileRoute("/auth/")({ component: SignInPage });

function SignInPage() {
  const navigate = Route.useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSignIn = isSupabaseReady;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.endsWith(".dom")) {
      setErrorMessage('Please check your email address. Did you mean ".com" instead of ".dom"?');
      return;
    }

    if (!isSupabaseReady) {
      setErrorMessage(getSupabaseUnavailableMessage());
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.session) {
        setErrorMessage("No active session was created. Please try again.");
        return;
      }

      const profile = await getSupabaseUserProfile(data.session.user);

      toast.success("Signed in successfully.");
      if (profile.role === "admin") {
        await navigate({ to: "/" });
        return;
      }

      await navigate({ to: "/buyer/shop" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageFrame
      title="Sign In"
      description="Sign in with your email and password to continue."
      footer={
        <p className="pt-2 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link
            to="/auth/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      }
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Sign-in Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sign-in-password">Password</Label>
          <div className="relative">
            <Input
              id="sign-in-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={!canSignIn || isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link
          to="/auth/forgot-password"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          to="/auth/sign-up"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </div>
    </AuthPageFrame>
  );
}
