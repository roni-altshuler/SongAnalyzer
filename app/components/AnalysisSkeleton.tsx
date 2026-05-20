'use client';

import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';

export default function AnalysisSkeleton() {
  return (
    <Card variant="elev1" className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] p-3.5 space-y-2"
          >
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </Card>
  );
}
