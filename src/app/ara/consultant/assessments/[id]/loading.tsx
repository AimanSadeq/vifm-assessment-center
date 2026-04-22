import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
