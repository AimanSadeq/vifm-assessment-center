"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

/**
 * Completes a password reset. The Supabase recovery email link lands here (or is
 * forwarded here from /login) with a recovery session in the URL hash; the
 * browser client establishes that session, then the user sets a new password.
 * Auth-bypassed in middleware so a user without a cookie session can reach it.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = supabaseRef.current;
    // Constructing the client parses the recovery token from the URL hash.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updErr } = await supabaseRef.current.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    // Sign out the temporary recovery session so the user logs in fresh.
    await supabaseRef.current.auth.signOut();
    setDone(true);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#5391D5]" /> Set a new password
        </CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Your password has been updated. You can sign in now.</p>
            <Link href="/login">
              <Button className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Go to login
              </Button>
            </Link>
          </div>
        ) : checking ? (
          <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
        ) : !hasSession ? (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This reset link is invalid or has expired. Request a new one.
            </div>
            <Link href="/password-reset">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Request a new link
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Saving..." : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
