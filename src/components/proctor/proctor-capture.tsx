"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera proctoring (Phase 1) - consent gate + periodic webcam snapshots.
 *
 * Renders nothing when `enabled` is false (the per-administration toggle is off).
 * When enabled it shows a BLOCKING consent overlay; on consent it requests the
 * camera, opens a proctoring session, and uploads a downscaled JPEG snapshot
 * every `intervalSeconds`. No continuous video/audio is recorded. Declining (or a
 * browser-level camera block) prevents the test from proceeding, since the
 * administration is proctored. Proctoring never silently fabricates a pass: if
 * the backend is unavailable the capture loop simply stores nothing.
 */

const CONSENT_TEXT =
  "This assessment is proctored. With your permission, your device camera will capture periodic snapshots during the test for integrity review. Snapshots are stored securely and automatically deleted after 90 days.";

type Phase = "consent" | "starting" | "active" | "denied";

export function ProctorCapture({
  enabled,
  context,
  refId,
  subjectName,
  subjectEmail,
  intervalSeconds = 15,
}: {
  enabled: boolean;
  context: string;
  refId?: string | null;
  subjectName?: string | null;
  subjectEmail?: string | null;
  intervalSeconds?: number;
}) {
  const [phase, setPhase] = useState<Phase>("consent");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Phase 2 motion: a tiny offscreen frame + the previous frame's pixels, for a
  // cheap frame-difference "room movement" score (temporal - the one signal a
  // single image can't give).
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevMotionRef = useRef<Uint8ClampedArray | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const sid = sessionRef.current;
    if (!video || !canvas || !sid || video.readyState < 2) return;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const W = 480;
    const H = Math.max(1, Math.round((vh / vw) * W));
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, W, H);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

    // Cheap motion score: mean abs diff of a 32x24 frame vs the previous one.
    let motion: number | undefined;
    try {
      const MW = 32;
      const MH = 24;
      const mc = motionCanvasRef.current ?? (motionCanvasRef.current = document.createElement("canvas"));
      mc.width = MW;
      mc.height = MH;
      const mctx = mc.getContext("2d", { willReadFrequently: true });
      if (mctx) {
        mctx.drawImage(video, 0, 0, MW, MH);
        const cur = mctx.getImageData(0, 0, MW, MH).data;
        const prev = prevMotionRef.current;
        if (prev && prev.length === cur.length) {
          let diff = 0;
          for (let p = 0; p < cur.length; p += 4) diff += Math.abs(cur[p] - prev[p]);
          const pixels = cur.length / 4;
          // normalise to 0-100 with a x3 sensitivity bump (typical idle diff is small).
          motion = Math.min(100, Math.round(((diff / pixels) / 255) * 100 * 3));
        }
        prevMotionRef.current = cur;
      }
    } catch {
      /* motion is best-effort */
    }

    try {
      await fetch("/api/proctor/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, image: dataUrl, motion }),
        keepalive: true,
      });
    } catch {
      /* drop this frame */
    }
  }, []);

  const begin = useCallback(async () => {
    setPhase("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    } catch {
      setPhase("denied");
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay policies - the stream is still live for canvas capture */
      }
    }
    try {
      const res = await fetch("/api/proctor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          ref_id: refId ?? null,
          subject_name: subjectName ?? null,
          subject_email: subjectEmail ?? null,
          consent_text: CONSENT_TEXT,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; session_id?: string };
      if (json?.ok && json.session_id) sessionRef.current = json.session_id;
    } catch {
      /* backend unavailable - camera stays on but nothing is stored */
    }
    setPhase("active");
    window.setTimeout(() => void capture(), 1500);
    timerRef.current = setInterval(() => void capture(), Math.max(5, intervalSeconds) * 1000);
  }, [capture, context, intervalSeconds, refId, subjectEmail, subjectName]);

  useEffect(() => {
    return () => {
      cleanup();
      const sid = sessionRef.current;
      if (sid && typeof navigator !== "undefined" && navigator.sendBeacon) {
        try {
          navigator.sendBeacon(
            "/api/proctor/end",
            new Blob([JSON.stringify({ session_id: sid })], { type: "application/json" })
          );
        } catch {
          /* best-effort */
        }
      }
    };
  }, [cleanup]);

  if (!enabled) return null;

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {phase !== "active" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#010131]">Camera proctoring</h2>
            {phase !== "denied" ? (
              <>
                <p className="mt-2 text-sm text-slate-600">{CONSENT_TEXT}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  <li>- Snapshots only: no continuous video or audio is recorded.</li>
                  <li>- Used solely for integrity review by an authorised reviewer.</li>
                  <li>- Automatically deleted after 90 days.</li>
                </ul>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => void begin()}
                    disabled={phase === "starting"}
                    className="rounded-md bg-[#5391D5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5391D5]/90 disabled:opacity-50"
                  >
                    {phase === "starting" ? "Starting camera..." : "I consent - enable my camera"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-rose-700">
                  This assessment is proctored and cannot be taken without camera access. Please allow camera access in
                  your browser and try again.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setPhase("consent")}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {phase === "active" && (
        <div className="fixed bottom-3 right-3 z-[90] flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Proctoring active
        </div>
      )}
    </>
  );
}
