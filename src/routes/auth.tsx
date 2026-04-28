import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({ component: AuthParentPage });

function AuthParentPage() {
  return <Outlet />;
}
