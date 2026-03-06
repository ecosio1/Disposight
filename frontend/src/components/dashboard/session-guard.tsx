"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setAuthenticated(true);
        } else if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
          router.replace("/login");
        }
      }
    );

    // "Remember me" / session-only logic
    const remember = sessionStorage.getItem("disposight_remember");
    const sessionOnly = sessionStorage.getItem("disposight_session_only");

    if (!remember && !sessionOnly) {
      const wasPreviouslySessionOnly = localStorage.getItem("disposight_session_only");
      if (wasPreviouslySessionOnly) {
        localStorage.removeItem("disposight_session_only");
        supabase.auth.signOut().then(() => router.push("/login"));
      }
    }

    if (sessionOnly) {
      localStorage.setItem("disposight_session_only", "1");
    } else if (remember) {
      localStorage.removeItem("disposight_session_only");
    }

    return () => subscription.unsubscribe();
  }, [router]);

  if (authenticated === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{
            borderColor: "var(--border-default)",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
