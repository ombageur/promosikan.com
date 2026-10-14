import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ListSkeleton } from "@/components/intelligence/states";
import { errorMessage } from "@/lib/firebase/callable";
import { ErrorState } from "./states";

/** State loading / error standar untuk satu query; `children` hanya dirender saat data siap. */
export function QueryBoundary<T>({
  query,
  loading,
  children,
}: {
  query: UseQueryResult<T>;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <ListSkeleton />}</>;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
