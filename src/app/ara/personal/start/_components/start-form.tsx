"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";

type StartActionResult =
  | { ok: false; error: string }
  | { ok: true; redirectTo: string };

type Props = {
  action: (fd: FormData) => Promise<StartActionResult>;
};

/**
 * Tiny client wrapper around the personal-assessment start server
 * action. The action returns either an error or a redirectTo URL;
 * we navigate via router.push on success.
 */
export function StartForm({ action }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [region, setRegion] = useState<"uae" | "saudi">("uae");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("language", language);
    fd.set("region", region);
    start(async () => {
      const result = await action(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.redirectTo);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Your name *</Label>
          <Input
            id="full_name"
            name="full_name"
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Sara Al Hashimi"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("en")}
              className="flex-1"
            >
              English
            </Button>
            <Button
              type="button"
              variant={language === "ar" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("ar")}
              className="flex-1"
            >
              العربية
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Region</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={region === "uae" ? "default" : "outline"}
              size="sm"
              onClick={() => setRegion("uae")}
              className="flex-1"
            >
              UAE
            </Button>
            <Button
              type="button"
              variant={region === "saudi" ? "default" : "outline"}
              size="sm"
              onClick={() => setRegion("saudi")}
              className="flex-1"
            >
              Saudi Arabia
            </Button>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {pending ? "Starting…" : "Start the snapshot"}
      </Button>
    </form>
  );
}
