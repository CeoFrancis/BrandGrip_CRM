import { RefreshCw, Cloud, CloudOff } from "lucide-react";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SyncIndicator() {
  const { isOnline, queueCount, isSyncing, syncQueue } = useOfflineQueue();

  if (isOnline && queueCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Cloud className="h-4 w-4 text-green-500" />
        <span>Synced</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2">
        <CloudOff className="h-4 w-4 text-yellow-500" />
        <span className="text-sm text-yellow-500">Offline</span>
        {queueCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {queueCount} pending
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={syncQueue}
        disabled={isSyncing}
        className="h-8 px-2"
      >
        <RefreshCw className={cn("h-4 w-4 mr-1", isSyncing && "animate-spin")} />
        {isSyncing ? 'Syncing...' : 'Sync'}
      </Button>
      <Badge variant="outline" className="text-xs">
        {queueCount} pending
      </Badge>
    </div>
  );
}
