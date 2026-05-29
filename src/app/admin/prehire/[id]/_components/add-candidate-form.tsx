"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { addCandidateAction } from "../../actions";

export function AddCandidateForm({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await addCandidateAction({
      requisition_id: requisitionId,
      full_name: fullName,
      email,
      phone: phone || undefined,
    });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    const link = `${window.location.origin}/prehire/apply/${res.data.access_token}`;
    toast.success("Candidate added. Invite link copied below.", { duration: 6000 });
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be unavailable; link is shown via the toast */
    }
    setFullName("");
    setEmail("");
    setPhone("");
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label htmlFor="cand-name">Candidate name</Label>
            <Input id="cand-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label htmlFor="cand-email">Email</Label>
            <Input id="cand-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="w-36 space-y-1.5">
            <Label htmlFor="cand-phone">Phone</Label>
            <Input id="cand-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !fullName || !email} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {submitting ? "Adding…" : "Add candidate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
