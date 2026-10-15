import * as React from "react";
import { useAuth } from "@/auth/AuthProvider";
import { LoginPage } from "@/auth/LoginPage";

export function ProtectedRoute({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div role="status" className="flex items-center gap-3 text-gray-500">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <span className="sr-only">Loading</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback ?? <LoginPage />}</>;
  }

  return <>{children}</>;
}
