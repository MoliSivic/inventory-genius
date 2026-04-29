import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isSupabaseAuthEnabled,
  isSupabaseConfigured,
  SUPABASE_AUTH_DISABLED_MESSAGE,
} from "@/lib/supabase";

type AuthPageFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthPageFrame({ title, description, children, footer }: AuthPageFrameProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <Card className="w-full border-border/80 shadow-lg">
          <CardHeader className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Inventory Genius
            </p>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupabaseAuthEnabled && (
              <Alert variant="destructive">
                <AlertTitle>Supabase Auth Required</AlertTitle>
                <AlertDescription>{SUPABASE_AUTH_DISABLED_MESSAGE}</AlertDescription>
              </Alert>
            )}
            {isSupabaseAuthEnabled && !isSupabaseConfigured && (
              <Alert variant="destructive">
                <AlertTitle>Supabase Not Configured</AlertTitle>
                <AlertDescription>
                  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.
                </AlertDescription>
              </Alert>
            )}
            {children}
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
