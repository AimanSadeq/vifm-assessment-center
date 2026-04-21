import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAraOrganization } from "@/lib/ara/actions";

export default function NewAraOrganizationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/ara/admin/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to organizations
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">New Organization</h1>
        <p className="text-muted-foreground mb-8">
          Add a GCC client organization. Region and sector drive regulatory framework selection.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAraOrganization} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Name (English) *</Label>
                <Input id="name" name="name" required maxLength={200} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ar">Name (Arabic)</Label>
                <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <select
                  id="region"
                  name="region"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select region…</option>
                  <option value="uae">United Arab Emirates</option>
                  <option value="saudi">Saudi Arabia</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  UAE clients see UAE frameworks only. Saudi clients see Saudi frameworks only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Sector *</Label>
                <select
                  id="sector"
                  name="sector"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select sector…</option>
                  <option value="government">Government &amp; Semi-Government</option>
                  <option value="banking">Banking &amp; Financial Services</option>
                  <option value="general">General / Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">Create organization</Button>
                <Link href="/ara/admin/organizations">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
