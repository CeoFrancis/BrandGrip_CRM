import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './use-online-status';
import { useToast } from './use-toast';
import {
  addToQueue,
  removeFromQueue,
  getQueuedOperations,
  getQueueCount,
  cacheLeads,
  getCachedLeads,
  updateCachedLead,
  deleteCachedLead,
  QueuedOperation,
  initDB,
} from '@/lib/offline-queue';

export function useOfflineQueue() {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize DB on mount
  useEffect(() => {
    initDB().then(() => {
      updateQueueCount();
    });
  }, []);

  const updateQueueCount = async () => {
    try {
      const count = await getQueueCount();
      setQueueCount(count);
    } catch (error) {
      console.error('Failed to get queue count:', error);
    }
  };

  // Sync queue when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0) {
      syncQueue();
    }
  }, [isOnline]);

  const syncQueue = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const operations = await getQueuedOperations();
      let successCount = 0;
      let failCount = 0;

      for (const op of operations) {
        try {
          await processOperation(op);
          await removeFromQueue(op.id);
          successCount++;
        } catch (error) {
          console.error('Failed to sync operation:', op, error);
          failCount++;
        }
      }

      await updateQueueCount();

      if (successCount > 0) {
        toast({
          title: 'Sync Complete',
          description: `Successfully synced ${successCount} change${successCount > 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: 'Some changes could not be synced. Will retry later.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const processOperation = async (op: QueuedOperation) => {
    // Currently only supports leads table
    if (op.table !== 'leads') {
      throw new Error(`Unsupported table: ${op.table}`);
    }

    switch (op.type) {
      case 'insert':
        // Remove temp ID before inserting
        const { id: tempId, ...insertData } = op.data;
        const { error: insertError } = await supabase
          .from('leads')
          .insert([insertData]);
        if (insertError) throw insertError;
        break;

      case 'update':
        const { id: updateId, ...updateData } = op.data;
        const { error: updateError } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', updateId);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .eq('id', op.data.id);
        if (deleteError) throw deleteError;
        break;
    }
  };

  const queueInsert = useCallback(async (table: string, data: any) => {
    // Generate a temporary ID for offline-created items
    const tempId = `temp_${crypto.randomUUID()}`;
    const dataWithId = { ...data, id: tempId };

    await addToQueue({ type: 'insert', table, data });
    await updateCachedLead(dataWithId);
    await updateQueueCount();

    toast({
      title: 'Saved Offline',
      description: 'Changes will sync when you\'re back online.',
    });

    return tempId;
  }, [toast]);

  const queueUpdate = useCallback(async (table: string, data: any) => {
    await addToQueue({ type: 'update', table, data });
    await updateCachedLead(data);
    await updateQueueCount();

    toast({
      title: 'Saved Offline',
      description: 'Changes will sync when you\'re back online.',
    });
  }, [toast]);

  const queueDelete = useCallback(async (table: string, id: string) => {
    await addToQueue({ type: 'delete', table, data: { id } });
    await deleteCachedLead(id);
    await updateQueueCount();

    toast({
      title: 'Deleted Offline',
      description: 'Changes will sync when you\'re back online.',
    });
  }, [toast]);

  return {
    isOnline,
    queueCount,
    isSyncing,
    syncQueue,
    queueInsert,
    queueUpdate,
    queueDelete,
    cacheLeads,
    getCachedLeads,
  };
}
