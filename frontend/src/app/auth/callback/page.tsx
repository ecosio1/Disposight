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

    // The URL contains the auth code from Supabase OAuth/email confirmation.
    // Using the browser client ensures the PKCE code verifier cookie (set
    // during signInWithOAuth/signUp) is accessible for the exchange.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
          }
          // Even if exchange failed, check if user is already authenticated
          return supabase.auth.getUser();
        })
        .then(({ data }) => {
          if (data?.user) {
            router.replace("/dashboard");
          } else {
            router.replace("/login?error=auth_failed");
          }
        })
        .catch(() => {
          router.replace("/login?error=auth_failed");
        });
    } else {
      // No code — check if already authenticated (e.g., hash fragment flow)
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          router.replace("/dashboard");
        } else {
          router.replace("/login?error=auth_failed");
        }
      });
    }
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
