"use client";

import { useActionState } from "react";
import { subscribeToNewsletter, type NewsletterState } from "@/app/(marketing)/newsletter/action";

interface NewsletterSignupProps {
  variant?: "inline" | "card" | "compact";
  headline?: string;
  description?: string;
}

const initial: NewsletterState = { success: false, error: null };

export function NewsletterSignup({
  variant = "card",
  headline = "Get weekly distress signals — free",
  description = "Every Monday: the week's top WARN filings, bankruptcies, SEC disclosures, and closures. No account needed.",
}: NewsletterSignupProps) {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initial);

  if (state.success) {
    return (
      <div
        className={variant === "compact" ? "py-3 text-center" : "rounded-lg p-6 sm:p-8 text-center"}
        style={variant === "compact" ? {} : {
          backgroundColor: "rgba(16, 185, 129, 0.05)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
        }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          You&apos;re in. Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <form action={formAction} className="mt-4">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
          {headline}
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            name="email"
            placeholder="you@company.com"
            required
            className="flex-1 min-w-0 px-3 py-1.5 rounded text-xs outline-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            {pending ? "..." : "Subscribe"}
          </button>
        </div>
        {state.error && (
          <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>{state.error}</p>
        )}
      </form>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className="rounded-md px-5 py-4 my-8 border-l-4"
        style={{
          borderColor: "var(--accent)",
          backgroundColor: "rgba(16, 185, 129, 0.04)",
        }}
      >
        <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
          {headline}
        </p>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
        <form action={formAction} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            name="email"
            placeholder="you@company.com"
            required
            className="flex-1 min-w-0 px-3 py-2 rounded-md text-sm outline-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            {pending ? "Subscribing..." : "Get Free Weekly Signals"}
          </button>
        </form>
        {state.error && (
          <p className="text-xs mt-1.5" style={{ color: "#ef4444" }}>{state.error}</p>
        )}
      </div>
    );
  }

  // Card variant (default)
  return (
    <div
      className="rounded-lg p-6 sm:p-8 text-center"
      style={{
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
      }}
    >
      <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        {headline}
      </h3>
      <p className="text-sm mb-5 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
      <form action={formAction} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <input
          type="email"
          name="email"
          placeholder="you@company.com"
          required
          className="flex-1 min-w-0 px-4 py-2.5 rounded-md text-sm outline-none"
          style={{
            backgroundColor: "var(--bg-base)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-all hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {pending ? "Subscribing..." : "Subscribe Free"}
        </button>
      </form>
      {state.error && (
        <p className="text-xs mt-2" style={{ color: "#ef4444" }}>{state.error}</p>
      )}
      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Free forever. Unsubscribe anytime. No spam.
      </p>
    </div>
  );
}
