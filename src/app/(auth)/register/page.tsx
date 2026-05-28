import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";

export default async function RegisterPage() {
  const t = await getServerT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("authPublic.register.title")}</CardTitle>
        <CardDescription>{t("authPublic.register.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t("authPublic.register.placeholder")}
        </p>
      </CardContent>
    </Card>
  );
}
