import { Loader2 } from "lucide-react";

export function PageLoading() {
  return (
    <div
      role="status"
      aria-label="loading"
      className="flex items-center justify-center py-20 w-full"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
      <span className="text-sm font-medium">Loading...</span>
    </div>
  );
} 