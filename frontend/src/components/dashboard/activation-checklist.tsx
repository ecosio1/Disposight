"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlan } from "@/contexts/plan-context";

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  description: string;
}

const ITEMS: ChecklistItem[] = [
  {
    key: "viewed_deals",
    label: "Browse top deals",
    href: "/dashboard",
    description: "See AI-scored opportunities ranked by value",
  },
  {
    key: "viewed_signals",
    label: "Explore distress signals",
    href: "/dashboard/overview",
    description: "Real-time data from WARN Act, SEC, courts & news",
  },
  {
    key: "added_watchlist",
    label: "Add a company to your watchlist",
    href: "/dashboard/watchlist",
    description: "Track companies and get notified on new signals",
  },
  {
    key: "created_alert",
    label: "Set up an alert",
    href: "/dashboard/alerts",
    description: "Get emailed when deals match your criteria",
  },
  {
    key: "viewed_map",
    label: "Explore the signal map",
    href: "/dashboard/map",
    description: "See distress signals geographically",
  },
];

const STORAGE_KEY = "disposight_activation";

function getCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCompleted(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function ActivationChecklist() {
  const { isTrial, daysLeft } = usePlan();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setCompleted(getCompleted());
    setDismissed(localStorage.getItem("disposight_activation_dismissed") === "1");
  }, []);

  if (!isTrial || dismissed) return null;

  const allDone = completed.size >= ITEMS.length;
  if (allDone) return null;

  const progress = Math.round((completed.size / ITEMS.length) * 100);

  const handleCheck = (key: string) => {
    const next = new Set(completed);
    next.add(key);
    setCompleted(next);
    saveCompleted(next);
  };

  return (
    <div
      className="rounded-lg p-4 mb-6"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Get started with DispoSight
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {completed.size}/{ITEMS.length} complete
            {daysLeft !== null && ` \u00b7 ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in trial`}
          </p>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem("disposight_activation_dismissed", "1");
          }}
          className="text-xs px-2 py-1 rounded"
          style={{ color: "var(--text-muted)" }}
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full mb-4"
        style={{ backgroundColor: "var(--bg-muted, rgba(255,255,255,0.05))" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--accent)",
          }}
        />
      </div>

      <div className="space-y-1">
        {ITEMS.map((item) => {
          const done = completed.has(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => handleCheck(item.key)}
              className="flex items-start gap-3 px-3 py-2 rounded-md transition-colors"
              style={{
                backgroundColor: done ? "transparent" : "var(--bg-base)",
                opacity: done ? 0.5 : 1,
              }}
            >
              <span
                className="mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px]"
                style={{
                  borderColor: done ? "var(--accent)" : "var(--border-default)",
                  backgroundColor: done ? "var(--accent)" : "transparent",
                  color: done ? "#fff" : "transparent",
                }}
              >
                {done ? "\u2713" : ""}
              </span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{
                    color: done ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {item.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
