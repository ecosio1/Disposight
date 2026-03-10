"use client";

import Link from "next/link";

export function StickySidebarCTA() {
  return (
    <div
      className="rounded-lg p-4 border mt-6"
      style={{
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        borderColor: "rgba(16, 185, 129, 0.2)",
      }}
    >
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Track distressed deals automatically
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Get real-time alerts on WARN filings, bankruptcies, and liquidation events.
      </p>
      <Link
        href="/register"
        className="block w-full text-center px-3 py-2 rounded-md text-xs font-medium transition-all hover:brightness-110"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
      >
        Start Free Trial
      </Link>
    </div>
  );
}
