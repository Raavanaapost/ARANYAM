import { ListSkeleton, Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <Skeleton className="mb-6 h-9 w-56" />
        <ListSkeleton rows={3} />
      </div>
      <div className="hidden space-y-4 lg:block">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}
