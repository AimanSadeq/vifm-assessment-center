"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ClipboardCheck,
  Users,
  Building2,
  LogIn,
  Mail,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevBypass, setShowDevBypass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Redirect based on user role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      switch (profile?.role) {
        case "admin":
          router.push("/admin");
          break;
        case "lead_assessor":
        case "associate_assessor":
          router.push("/assessor");
          break;
        case "candidate":
          router.push("/candidate");
          break;
        case "client":
          router.push("/client");
          break;
        default:
          router.push("/admin");
      }
    } else {
      router.push("/admin");
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setError(null);
      alert("Check your email for a login link.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign In</CardTitle>
          <CardDescription>
            Welcome to the VIFM Assessment Center Portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@vifm.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full gap-2" size="lg">
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full gap-2"
            >
              <Mail className="h-4 w-4" />
              Sign in with Magic Link
            </Button>

            <div className="text-center">
              <Link href="/password-reset" className="text-xs text-muted-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>

          <Separator className="my-4" />

          {/* Dev bypass — hidden by default */}
          <button
            type="button"
            onClick={() => setShowDevBypass(!showDevBypass)}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground w-full text-center"
          >
            {showDevBypass ? "Hide dev options" : "Dev options"}
          </button>

          {showDevBypass && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] text-muted-foreground text-center">
                Development bypass — no authentication
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                    <Shield className="h-3 w-3" /> Admin
                  </Button>
                </Link>
                <Link href="/assessor">
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                    <ClipboardCheck className="h-3 w-3" /> Assessor
                  </Button>
                </Link>
                <Link href="/candidate">
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                    <Users className="h-3 w-3" /> Candidate
                  </Button>
                </Link>
                <Link href="/client">
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
                    <Building2 className="h-3 w-3" /> Client
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
