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
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (!error && data.session) {
            router.replace("/dashboard");
            return;
          }
          // Fallback: check if user is already authenticated
          return supabase.auth.getUser().then(({ data: userData }) => {
            router.replace(userData?.user ? "/dashboard" : "/login?error=auth_failed");
          });
        })
        .catch(() => {
          router.replace("/login?error=auth_failed");
        });
    } else {
      // No code — check if already authenticated
      supabase.auth.getUser().then(({ data }) => {
        router.replace(data?.user ? "/dashboard" : "/login?error=auth_failed");
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
