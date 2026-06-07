"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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

import { LogIn, Mail, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DEMO_ROLES = [
  { id: "Admin", labelKey: "authPublic.login.roleAdmin", email: "admin@viftraining.com", password: "admin123", redirect: "/" },
  { id: "Assessor", labelKey: "authPublic.login.roleAssessor", email: "assessor@viftraining.com", password: "admin123", redirect: "/assessor" },
  { id: "Candidate", labelKey: "authPublic.login.roleCandidate", email: "candidate@viftraining.com", password: "admin123", redirect: "/candidate" },
  { id: "Client", labelKey: "authPublic.login.roleClient", email: "client@viftraining.com", password: "admin123", redirect: "/client" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const quickLogin = async (targetEmail: string, targetPassword: string, redirect: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: targetPassword,
    });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    router.push(redirect);
  };

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

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      switch (profile?.role) {
        // Admins (and any unrecognised role) land on the All Services launcher.
        case "admin": router.push("/"); break;
        case "lead_assessor":
        case "associate_assessor": router.push("/assessor"); break;
        case "candidate": router.push("/candidate"); break;
        case "client": router.push("/client"); break;
        default: router.push("/");
      }
    } else {
      router.push("/");
    }
  };

  const handleMagicLink = async () => {
    if (!email) { setError(t("authPublic.login.enterEmailFirst")); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });

    setLoading(false);
    if (authError) { setError(authError.message); }
    else { alert(t("authPublic.login.checkEmailLink")); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("authPublic.login.title")}</CardTitle>
          <CardDescription>
            {t("authPublic.login.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick role login - compact dropdown for dev/demo */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={loading}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none pr-8"
              >
                <option value="">{t("authPublic.login.selectRole")}</option>
                {DEMO_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{t(r.labelKey)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              disabled={loading || !selectedRole}
              onClick={() => {
                const role = DEMO_ROLES.find((r) => r.id === selectedRole);
                if (role) quickLogin(role.email, role.password, role.redirect);
              }}
              className="shrink-0"
            >
              {loading ? t("authPublic.login.signingIn") : t("authPublic.login.quickLogin")}
            </Button>
          </div>

          <Separator />

          {/* Email/password form */}
          {(
            <form onSubmit={handleLogin} className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t("authPublic.login.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("authPublic.login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("authPublic.login.passwordLabel")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("authPublic.login.passwordPlaceholder")}
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

              <Button type="submit" disabled={loading} className="w-full gap-2">
                <LogIn className="h-4 w-4" />
                {loading ? t("authPublic.login.signingIn") : t("authPublic.login.signIn")}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full gap-2"
              >
                <Mail className="h-4 w-4" />
                {t("authPublic.login.magicLink")}
              </Button>

              <div className="text-center">
                <Link href="/password-reset" className="text-xs text-muted-foreground hover:underline">
                  {t("authPublic.login.forgotPassword")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
