"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, PlanLimitError, type WatchlistItem, type PipelineSummary } from "@/lib/api";
import { PlanGate } from "@/components/dashboard/plan-gate";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { usePlan } from "@/contexts/plan-context";
import { TeamLeaderboard } from "@/components/dashboard/team-leaderboard";
import { FollowUpIndicator } from "@/components/dashboard/follow-up-indicator";


const PIPELINE_STAGES = [
  { key: "identified", label: "Identified", color: "var(--text-muted)" },
  { key: "researching", label: "Researching", color: "var(--accent)" },
  { key: "contacted", label: "Contacted", color: "var(--high)" },
  { key: "negotiating", label: "Negotiating", color: "var(--medium)" },
  { key: "won", label: "Won", color: "#10b981" },
  { key: "lost", label: "Lost", color: "var(--critical)" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--critical)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--text-muted)",
};

const PRIORITY_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  urgent: { label: "URGENT", bg: "rgba(239,68,68,0.12)", text: "var(--critical)" },
  high: { label: "HIGH", bg: "rgba(249,115,22,0.12)", text: "var(--high)" },
  medium: { label: "MED", bg: "rgba(234,179,8,0.12)", text: "var(--medium)" },
  low: { label: "LOW", bg: "rgba(148,163,184,0.1)", text: "var(--text-muted)" },
};

const LOST_REASONS = [
  "No asset opportunity",
  "Competitor won",
  "Timing not right",
  "No response",
  "Deal too small",
  "Other",
];

export default function PipelinePage() {
  const { user, isPro } = usePlan();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const canViewTeam = isManager && isPro;
  const [view, setView] = useState<"mine" | "team">(canViewTeam ? "team" : "mine");
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamGateMsg, setTeamGateMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [lostModalId, setLostModalId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setTeamGateMsg(null);
    const fetcher = view === "team" ? api.getTeamPipeline() : api.getMyPipeline();
    fetcher
      .then(setItems)
      .catch((err) => {
        if (err instanceof PlanLimitError) {
          setTeamGateMsg(err.message);
          setView("mine");
        }
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => {
    api.getPipelineSummary().then(setSummary).catch(() => {});
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === "lost") {
      setLostModalId(id);
      return;
    }
    try {
      const updated = await api.updateLeadStatus(id, newStatus);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {}
  };

  const handleLostConfirm = async (reason: string) => {
    if (!lostModalId) return;
    try {
      const updated = await api.updateLeadStatus(lostModalId, "lost", reason);
      setItems((prev) => prev.map((item) => (item.id === lostModalId ? updated : item)));
    } catch {}
    setLostModalId(null);
  };

  // Group by status
  const grouped: Record<string, WatchlistItem[]> = {};
  for (const stage of PIPELINE_STAGES) {
    grouped[stage.key] = items.filter((item) => (item.status || "identified") === stage.key);
  }

  return (
    <PlanGate>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {view === "team" ? "Team Pipeline" : "My Pipeline"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {items.length} leads in pipeline
            </p>
          </div>
          {isManager && (
            <div className="flex gap-1 rounded-md overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <button
                onClick={() => setView("mine")}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: view === "mine" ? "var(--accent-muted)" : "var(--bg-surface)",
                  color: view === "mine" ? "var(--accent-text)" : "var(--text-secondary)",
                }}
              >
                My Leads
              </button>
              <button
                onClick={() => isPro ? setView("team") : setTeamGateMsg("Team Pipeline requires the Professional plan.")}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: view === "team" ? "var(--accent-muted)" : "var(--bg-surface)",
                  color: view === "team" ? "var(--accent-text)" : "var(--text-secondary)",
                  opacity: isPro ? 1 : 0.6,
                }}
              >
                Team View{!isPro ? " (Pro)" : ""}
              </button>
            </div>
          )}
        </div>

        {teamGateMsg && <UpgradePrompt message={teamGateMsg} />}

        {/* Summary bar */}
        {summary && (
          <div className="flex gap-4 flex-wrap">
            <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <span style={{ color: "var(--text-muted)" }}>Total: </span>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{summary.total}</span>
            </div>
            {summary.overdue_follow_ups > 0 && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--critical)15", border: "1px solid var(--critical)" }}>
                <span style={{ color: "var(--critical)" }}>
                  {summary.overdue_follow_ups} overdue follow-up{summary.overdue_follow_ups !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {summary.won_this_month > 0 && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#10b98115", border: "1px solid #10b981" }}>
                <span style={{ color: "#10b981" }}>{summary.won_this_month} won this month</span>
              </div>
            )}
            {summary.lost_this_month > 0 && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <span style={{ color: "var(--text-muted)" }}>{summary.lost_this_month} lost this month</span>
              </div>
            )}
          </div>
        )}

        {/* Team leaderboard (manager only) */}
        {view === "team" && isManager && items.length > 0 && (
          <TeamLeaderboard items={items} />
        )}

        {loading ? (
          <div className="flex gap-5 overflow-x-auto pb-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="min-w-[280px] h-48 rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-surface)" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 rounded-xl text-center" style={{ backgroundColor: "var(--bg-surface)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              No leads in your pipeline yet
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Claim leads from the{" "}
              <Link href="/dashboard" className="hover:underline" style={{ color: "var(--accent)" }}>
                Deals
              </Link>
              {" "}page to start building your pipeline
            </p>
          </div>
        ) : (
          /* Kanban Board */
          <div className="flex gap-5 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const stageItems = grouped[stage.key] || [];
              return (
                <div
                  key={stage.key}
                  className="min-w-[280px] flex-shrink-0 rounded-xl flex flex-col"
                  style={{ backgroundColor: "var(--bg-surface)" }}
                >
                  {/* Column header */}
                  <div
                    className="px-4 py-3 rounded-t-xl"
                    style={{ borderTop: `3px solid ${stage.color}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stage.color }}>
                        {stage.label}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${stage.color} 12%, transparent)`, color: stage.color }}
                      >
                        {stageItems.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-320px)]">
                    {stageItems.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No items</p>
                      </div>
                    ) : (
                      stageItems.map((item) => (
                        <PipelineCard
                          key={item.id}
                          item={item}
                          stageColor={stage.color}
                          onStatusChange={handleStatusChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lost reason modal */}
        {lostModalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="rounded-lg p-6 w-80 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Why are you marking this as lost?
              </h3>
              <div className="space-y-2">
                {LOST_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleLostConfirm(reason)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:opacity-80"
                    style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLostModalId(null)}
                className="w-full text-center text-xs py-2"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </PlanGate>
  );
}

function PipelineCard({
  item,
  stageColor,
  onStatusChange,
}: {
  item: WatchlistItem;
  stageColor: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const lastActivityAge = item.last_activity_at
    ? (() => {
        const diff = Date.now() - new Date(item.last_activity_at).getTime();
        const days = Math.floor(diff / 86_400_000);
        if (days === 0) return "today";
        if (days === 1) return "1d ago";
        return `${days}d ago`;
      })()
    : null;

  const priorityBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.low;

  return (
    <div
      className="p-3.5 rounded-lg space-y-2.5 transition-colors"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        ["--hover-border" as string]: "var(--accent)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
    >
      {/* Header: Company name + deal score circle */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/opportunities/${item.company_id}`}
          className="text-sm font-semibold hover:underline leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {item.company_name || "Unknown"}
        </Link>
        {item.deal_score != null && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              border: `2px solid ${item.deal_score >= 85 ? "var(--critical)" : item.deal_score >= 70 ? "var(--high)" : item.deal_score >= 55 ? "var(--medium)" : "var(--low)"}`,
            }}
            title={`Deal Score: ${item.deal_score}`}
          >
            <span
              className="text-[11px] font-mono font-bold"
              style={{
                color: item.deal_score >= 85 ? "var(--critical)" : item.deal_score >= 70 ? "var(--high)" : item.deal_score >= 55 ? "var(--medium)" : "var(--low)",
              }}
            >
              {item.deal_score}
            </span>
          </div>
        )}
      </div>

      {/* Priority badge + activity age */}
      <div className="flex items-center gap-2">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
          style={{ backgroundColor: priorityBadge.bg, color: priorityBadge.text }}
        >
          {priorityBadge.label}
        </span>
        {lastActivityAge && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {lastActivityAge}
          </span>
        )}
        {item.activity_count > 0 && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {item.activity_count} act.
          </span>
        )}
      </div>

      {/* Stats row: Risk Score + Deal Score number */}
      {(item.composite_risk_score != null || item.deal_score != null) && (
        <div className="flex gap-3">
          {item.composite_risk_score != null && (
            <div>
              <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Risk</p>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {Math.round(item.composite_risk_score)}
              </p>
            </div>
          )}
          {item.deal_score != null && (
            <div>
              <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Deal</p>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {item.deal_score}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Follow-up indicator (own row when present) */}
      {item.follow_up_at && (
        <div>
          <FollowUpIndicator followUpAt={item.follow_up_at} compact />
        </div>
      )}

      {/* Claimed by */}
      {item.claimed_by_name && (
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
            style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent-text)" }}
          >
            {item.claimed_by_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {item.claimed_by_name}
          </span>
        </div>
      )}

      {/* Status selector — pill style */}
      <select
        value={item.status || "identified"}
        onChange={(e) => onStatusChange(item.id, e.target.value)}
        className="w-full px-2.5 py-1 rounded-full text-[11px] font-medium outline-none cursor-pointer"
        style={{
          backgroundColor: `color-mix(in srgb, ${stageColor} 8%, transparent)`,
          border: "none",
          color: stageColor,
        }}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
