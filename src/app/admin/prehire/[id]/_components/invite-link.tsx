"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";

export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  // Build the absolute URL client-side (avoids SSR/hydration mismatch).
  useEffect(() => {
    setUrl(`${window.location.origin}/prehire/apply/${token}`);
  }, [token]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={copy} title={url} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Invite link"}
    </Button>
  );
}
