"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole, type Role } from "@/hooks/useRole";

interface RoleGateProps {
  allowedRoles: Role[];
  redirectTo?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({
  allowedRoles,
  redirectTo = "/login",
  children,
  fallback,
}: RoleGateProps) {
  const { role } = useRole();
  const router = useRouter();

  const hasAccess = allowedRoles.includes(role);

  useEffect(() => {
    if (!hasAccess && !fallback) {
      router.replace(redirectTo);
    }
  }, [hasAccess, redirectTo, fallback, router]);

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
