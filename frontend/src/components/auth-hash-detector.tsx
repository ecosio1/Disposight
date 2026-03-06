"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Detects Supabase auth hash fragments (#access_token=...) on any page.
 * With implicit flow, Supabase may redirect to the Site URL with tokens
 * in the hash. This component detects that and completes the sign-in.
 */
export function AuthHashDetector() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    // Hash fragment contains auth tokens — let Supabase process them
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          // Clean the hash from the URL and redirect to dashboard
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/dashboard");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
