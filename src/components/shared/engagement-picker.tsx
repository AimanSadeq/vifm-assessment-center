import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";

type Engagement = {
  id: string;
  name: string;
  status: string;
  target_role: string | null;
  orgName: string;
  assignmentCount: number;
};

type Props = {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  engagements: Engagement[];
  buildHref: (engagementId: string) => string;
};

export function EngagementPicker({
  title,
  description,
  backHref,
  backLabel,
  engagements,
  buildHref,
}: Props) {
  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-muted-foreground text-sm">{description}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {engagements.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
            No engagements available.
          </p>
        ) : (
          engagements.map((eng) => (
            <Link key={eng.id} href={buildHref(eng.id)}>
              <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{eng.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{eng.orgName}</span>
                    <Badge variant="secondary">{eng.status}</Badge>
                  </div>
                  {eng.target_role && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target: {eng.target_role}
                    </p>
                  )}
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{eng.assignmentCount}</span> assignments
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
