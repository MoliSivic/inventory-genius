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
  getAuthRedirectUrl,
  getSupabaseClient,
  getSupabaseUserProfile,
  getSupabaseUnavailableMessage,
  isSupabaseReady,
} from "@/lib/supabase";

export const Route = createFileRoute("/auth/sign-up")({ component: SignUpPage });

function SignUpPage() {
  const navigate = Route.useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessEmail("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName) {
      setErrorMessage("Name is required.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
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
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/auth/confirm"),
          data: {
            full_name: normalizedName,
            name: normalizedName,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        const profile = await getSupabaseUserProfile(data.session.user);

        toast.success("Account created and signed in.");
        if (profile.role === "admin") {
          await navigate({ to: "/" });
          return;
        }

        await navigate({ to: "/buyer/shop" });
        return;
      }

      setSuccessEmail(normalizedEmail);
      toast.success("Account created. Check your email to confirm your account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageFrame
      title="Create Account"
      description="Create your account with email and password."
      footer={
        <p className="pt-2 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Sign-up Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successEmail && (
        <Alert>
          <AlertTitle>Confirmation Email Sent</AlertTitle>
          <AlertDescription>
            We sent a verification link to {successEmail}. Confirm your email before signing in.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sign-up-name">Name</Label>
          <Input
            id="sign-up-name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sign-up-email">Email</Label>
          <Input
            id="sign-up-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sign-up-password">Password</Label>
          <div className="relative">
            <Input
              id="sign-up-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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

        <div className="space-y-1.5">
          <Label htmlFor="sign-up-confirm-password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="sign-up-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pr-10"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={!isSupabaseReady || isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </AuthPageFrame>
  );
}
