"use client";

import { useRef, useState } from "react";
import { Play, Volume2 } from "lucide-react";

/**
 * Replay-capped audio player for scored listening items (shared by the Fluent
 * runner and the Pre-Hire English stage). A native `<audio controls>` lets
 * candidates replay unlimited times and download the voice file (trial
 * findings, Fluent + Pre-Hire). This custom player:
 *  - counts each deliberate play; disables after `maxPlays` (the "up to twice"
 *    promise is actually enforced),
 *  - shows a duration + progress read-out via preload="metadata",
 *  - exposes no download control (controlsList nodownload + right-click
 *    blocked) and no scrubbable seek bar (the progress bar is display-only).
 */
export function CappedAudio({
  src, maxPlays, playLabel, playingLabel, replaysLeft, persistKey, preload = "metadata",
}: {
  src: string;
  maxPlays: number;
  playLabel: string;
  playingLabel: string;
  replaysLeft: string;
  /** When set, the play count survives refresh / a second tab (localStorage).
   *  Without it, a refresh resets the counter - which became a free bypass
   *  once in-progress answers started persisting across reloads. */
  persistKey?: string;
  /** "metadata" (default) shows the duration up-front but fetches on every
   *  mount. Pass "none" when the server counts audio deliveries (Pre-Hire) -
   *  otherwise each page refresh would burn a serve without a single play. */
  preload?: "metadata" | "none";
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const storageKey = persistKey ? `capped-audio:${persistKey}` : null;
  const [plays, setPlays] = useState(() => {
    if (!storageKey || typeof window === "undefined") return 0;
    try {
      const n = Number(window.localStorage.getItem(storageKey));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
  });
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const exhausted = plays >= maxPlays;
  const fmt = (s: number) =>
    Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
  const play = () => {
    const a = ref.current;
    if (!a || exhausted || playing) return;
    a.currentTime = 0;
    // Count on the actual `play` event (onPlay), not on click - a rejected/errored
    // start must not cost the candidate one of their replays on a scored item.
    void a.play().catch(() => setPlaying(false));
  };
  return (
    <div className="flex flex-1 items-center gap-3">
      <audio
        ref={ref}
        src={src}
        preload={preload}
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => {
          setPlaying(true);
          setPlays((p) => {
            const next = p + 1;
            if (storageKey) { try { window.localStorage.setItem(storageKey, String(next)); } catch { /* best-effort */ } }
            return next;
          });
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={play}
        disabled={exhausted || playing}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4380c4] disabled:opacity-50"
      >
        {playing ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? playingLabel : playLabel}
      </button>
      <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-accent transition-[width]" style={{ width: dur > 0 ? `${Math.min(100, (cur / dur) * 100)}%` : "0%" }} />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{fmt(cur)} / {fmt(dur)}</span>
      <span className="shrink-0 text-[11px] text-slate-400">{Math.max(0, maxPlays - plays)} {replaysLeft}</span>
    </div>
  );
}
