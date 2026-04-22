import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-8 w-52 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
