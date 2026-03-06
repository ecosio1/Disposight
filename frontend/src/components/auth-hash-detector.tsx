"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Detects Supabase auth hash fragments (#access_token=...) on any page.
 * With implicit flow, the client auto-processes the hash during init
 * and fires onAuthStateChange when done.
 */
export function AuthHashDetector() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const supabase = createClient();

    // Listen for the session that will be established when the client
    // finishes processing the hash fragment (async during init).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/dashboard");
        }
      }
    );

    // Safety timeout — if no event fires in 5s, check directly
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/dashboard");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
