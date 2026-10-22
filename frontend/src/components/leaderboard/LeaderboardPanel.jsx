import { useCallback, useEffect, useState } from "react";
import LeaderboardRow from "./LeaderboardRow.jsx";
import { BLUE, RED } from "../../theme.js";
import { getLeaderboard } from "../../api/leaderboard.js";

const SCOPES = [["global", "Global"], ["red", "Red Team"], ["blue", "Blue Team"]];
const PERIODS = [["event", "This Event"], ["all", "All Time"]];
const LIMIT = 20;

/** Leaderboard as an inline section (used inside the Profile page). Refreshes every 30s while mounted. */
export default function LeaderboardPanel({ accent }) {
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("event");
  const [data, setData] = useState({ entries: [], me: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const next = await getLeaderboard({ scope, period, limit: LIMIT });
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [scope, period]);

  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(false), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const tabColor = { global: accent, red: RED, blue: BLUE };

  return (
    <section className="mt-8 px-4" aria-label="Leaderboard">
      <h2 className="mb-3 font-display text-lg font-bold">Leaderboard</h2>

      <div role="tablist" aria-label="Faction" className="grid grid-cols-3 gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {SCOPES.map(([id, label]) => {
          const on = scope === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setScope(id)}
              className="rounded-md border py-2.5 text-sm font-medium transition"
              style={{
                borderColor: on ? tabColor[id] : "transparent",
                background: on ? `${tabColor[id]}33` : "transparent",
                boxShadow: on ? `0 0 12px ${tabColor[id]}66` : "none",
                color: on ? "#fff" : "#cbd5e1",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.02] p-1">
        {PERIODS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPeriod(id)}
            className="rounded-md py-2 text-xs font-medium transition"
            style={{ background: period === id ? "rgba(255,255,255,.09)" : "transparent", color: period === id ? "#fff" : "#94a3b8" }}
          >
            {label}
          </button>
        ))}
      </div>

      {data.me && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-center text-xs text-slate-300">
          Your rank: <span className="font-semibold text-white">#{data.me.rank}</span>
          <span className="mx-2 text-slate-600">•</span>
          {data.me.points.toLocaleString()} points
        </div>
      )}

      <div className="mt-4 grid grid-cols-[2.5rem_1fr_3rem_4.25rem] px-2 text-xs text-mute">
        <span className="text-center">#</span>
        <span>Player</span>
        <span className="text-center">Lv</span>
        <span className="text-right">Points</span>
      </div>

      <div className="mt-2">
        {loading && !data.entries.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">Loading leaderboard…</div>
        ) : error ? (
          <div className="mt-2 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-center text-sm text-red-200">
            {error}
            <button onClick={() => load(true)} className="mt-3 block w-full text-xs font-semibold text-white underline">Retry</button>
          </div>
        ) : !data.entries.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">No ranked players yet.</div>
        ) : (
          <ol className="space-y-1">
            {data.entries.map((player) => (
              <LeaderboardRow key={player.user_id} player={player} isMe={player.user_id === data.me?.user_id} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
