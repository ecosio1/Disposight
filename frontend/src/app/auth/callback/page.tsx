"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);
  const [debug, setDebug] = useState<string>("Initializing...");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const supabase = createClient();
    const fullUrl = window.location.href;
    const search = window.location.search;
    const hash = window.location.hash;
    const params = new URLSearchParams(search);
    const code = params.get("code");

    // Collect all cookie names for debugging (no values for security)
    const cookieNames = document.cookie
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean);

    setDebug(
      `URL: ${fullUrl}\nSearch: ${search}\nHash: ${hash ? hash.substring(0, 50) + "..." : "(none)"}\nCode: ${code ? code.substring(0, 20) + "..." : "(none)"}\nCookies: ${cookieNames.join(", ") || "(none)"}`
    );

    if (code) {
      setDebug((d) => d + "\n\nAttempting exchangeCodeForSession...");
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            setDebug(
              (d) =>
                d +
                `\n\nEXCHANGE ERROR: ${error.message}` +
                `\nError name: ${error.name}` +
                `\nError status: ${(error as any).status || "n/a"}`
            );
          } else {
            setDebug(
              (d) =>
                d +
                `\n\nEXCHANGE SUCCESS!` +
                `\nUser: ${data.user?.email || "unknown"}` +
                `\nSession: ${data.session ? "yes" : "no"}`
            );
            // Success — redirect after brief delay so we can see the debug output
            setTimeout(() => router.replace("/dashboard"), 2000);
            return;
          }

          // Exchange failed, try getUser as fallback
          setDebug((d) => d + "\n\nTrying getUser fallback...");
          return supabase.auth.getUser();
        })
        .then((result) => {
          if (!result) return; // already redirected
          const { data, error } = result;
          if (data?.user) {
            setDebug(
              (d) => d + `\ngetUser SUCCESS: ${data.user!.email}`
            );
            setTimeout(() => router.replace("/dashboard"), 2000);
          } else {
            setDebug(
              (d) =>
                d +
                `\ngetUser FAILED: ${error?.message || "no user"}` +
                "\n\n--- AUTH FAILED ---" +
                "\nRedirecting to login in 10 seconds..."
            );
            setTimeout(() => router.replace("/login?error=auth_failed"), 10000);
          }
        })
        .catch((err) => {
          setDebug((d) => d + `\n\nUNEXPECTED ERROR: ${err.message}`);
          setTimeout(() => router.replace("/login?error=auth_failed"), 10000);
        });
    } else if (hash && hash.includes("access_token")) {
      setDebug((d) => d + "\n\nHash fragment detected, waiting for auto-session...");
      supabase.auth.onAuthStateChange((event, session) => {
        setDebug((d) => d + `\nAuth event: ${event}, session: ${session ? "yes" : "no"}`);
        if (session) {
          setTimeout(() => router.replace("/dashboard"), 2000);
        }
      });
    } else {
      setDebug((d) => d + "\n\nNo code or hash found. Checking existing session...");
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setDebug((d) => d + `\nFound existing user: ${data.user!.email}`);
          setTimeout(() => router.replace("/dashboard"), 2000);
        } else {
          setDebug(
            (d) => d + "\nNo user found.\n\n--- AUTH FAILED ---\nRedirecting to login in 10 seconds..."
          );
          setTimeout(() => router.replace("/login?error=auth_failed"), 10000);
        }
      });
    }
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
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
        <pre
          className="text-xs p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap"
          style={{
            backgroundColor: "#111",
            color: "#10b981",
            border: "1px solid #333",
          }}
        >
          {debug}
        </pre>
      </div>
    </div>
  );
}
