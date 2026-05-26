"""
VIFM Fluent - speaking-task transcription via faster-whisper.

Called by the /api/ac/fluent/transcribe route. Reads one audio file
(any ffmpeg-decodable container: webm/ogg/mp4/wav) and prints a single
JSON line to stdout: {"transcript": "..."} on success, {"error": "..."}
on failure (with a non-zero exit code).

Usage:  python scripts/whisper-transcribe.py <audio_path> [model_size]

Model size defaults to WHISPER_MODEL env or "base" (fast, English-grade
enough for CEFR transcript scoring). Output is ASCII-safe JSON so a
Windows cp1252 console can print it without a UnicodeEncodeError.
"""
import json
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no audio path given"}))
        return 2

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("WHISPER_MODEL", "base")

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"audio file not found: {audio_path}"}))
        return 2

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:  # pragma: no cover - import-time env issue
        print(json.dumps({"error": f"faster_whisper unavailable: {exc}"}))
        return 3

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, _info = model.transcribe(
            audio_path,
            language="en",
            task="transcribe",
            beam_size=5,
            vad_filter=True,
        )
        transcript = " ".join(seg.text.strip() for seg in segments).strip()
        print(json.dumps({"transcript": transcript}, ensure_ascii=True))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"transcription failed: {exc}"}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
