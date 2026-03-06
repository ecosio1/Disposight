"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const supabase = createClient();

    // With implicit flow, Supabase sends tokens in the URL hash fragment.
    // The Supabase client auto-detects them via onAuthStateChange.
    // With PKCE flow (fallback), tokens come as ?code= query param.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          router.replace("/dashboard");
        }
      }
    );

    // Also try explicit code exchange in case PKCE code is in the URL
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        if (data.session) {
          router.replace("/dashboard");
        }
      });
    }

    // If no auth event fires within 5 seconds, check if already authenticated
    const timeout = setTimeout(() => {
      supabase.auth.getUser().then(({ data }) => {
        router.replace(data?.user ? "/dashboard" : "/login?error=auth_failed");
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{
            borderColor: "var(--border-default)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Signing you in...
        </p>
      </div>
    </div>
  );
}
