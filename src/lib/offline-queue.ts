// IndexedDB-based offline queue for lead operations

const DB_NAME = 'crm-offline-db';
const DB_VERSION = 1;
const QUEUE_STORE = 'offline-queue';
const LEADS_CACHE_STORE = 'leads-cache';

export interface QueuedOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
}

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
      
      if (!database.objectStoreNames.contains(LEADS_CACHE_STORE)) {
        database.createObjectStore(LEADS_CACHE_STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function addToQueue(operation: Omit<QueuedOperation, 'id' | 'timestamp'>): Promise<string> {
  const database = await initDB();
  const id = crypto.randomUUID();
  const queuedOp: QueuedOperation = {
    ...operation,
    id,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.add(queuedOp);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getQueuedOperations(): Promise<QueuedOperation[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const operations = request.result as QueuedOperation[];
      // Sort by timestamp to maintain order
      operations.sort((a, b) => a.timestamp - b.timestamp);
      resolve(operations);
    };
  });
}

export async function getQueueCount(): Promise<number> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Cache leads for offline viewing
export async function cacheLeads(leads: any[]): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEADS_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(LEADS_CACHE_STORE);
    
    // Clear existing cache
    store.clear();
    
    // Add all leads
    leads.forEach(lead => store.add(lead));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedLeads(): Promise<any[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEADS_CACHE_STORE, 'readonly');
    const store = transaction.objectStore(LEADS_CACHE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function updateCachedLead(lead: any): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEADS_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(LEADS_CACHE_STORE);
    const request = store.put(lead);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteCachedLead(id: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEADS_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(LEADS_CACHE_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
