export type VisitorResult = {
  id: string;
  createdAt: string;
  status: "completed" | "failed" | "cancelled";
  result?: unknown;
  error?: string;
};

export type PendingVisitorJob = {
  localId: string;
  jobId: string;
  capability: string;
  createdAt: string;
};

const databaseName = "figure-relay-visitor-history";
const storeName = "results";
const pendingKey = "figure-relay-pending-job-v1";
const pendingMaxAgeMs = 6 * 60 * 60 * 1000;
let pendingExpiredNotice = false;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support local report history."));
      return;
    }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local report history."));
    request.onblocked = () => reject(new Error("Local report history is blocked by another open tab."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error("Local report history operation failed."));
      transaction.oncomplete = () => resolve(result!);
      transaction.onabort = () => reject(transaction.error || new Error("Local report history transaction failed."));
    });
  } finally {
    database.close();
  }
}

export async function listVisitorResults(): Promise<VisitorResult[]> {
  const records = await withStore<VisitorResult[]>("readonly", store => store.getAll());
  return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveVisitorResult(record: VisitorResult): Promise<IDBValidKey> {
  return withStore<IDBValidKey>("readwrite", store => store.put(record));
}

export function deleteVisitorResult(id: string): Promise<undefined> {
  return withStore<undefined>("readwrite", store => store.delete(id));
}

export function clearVisitorResults(): Promise<undefined> {
  return withStore<undefined>("readwrite", store => store.clear());
}

export function readPendingVisitorJob(): PendingVisitorJob | null {
  try {
    const value = localStorage.getItem(pendingKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingVisitorJob>;
    const createdAt = typeof parsed.createdAt === "string" ? Date.parse(parsed.createdAt) : NaN;
    if (!Number.isFinite(createdAt) || createdAt > Date.now() + 60_000 || Date.now() - createdAt > pendingMaxAgeMs) {
      pendingExpiredNotice = Number.isFinite(createdAt) && Date.now() - createdAt > pendingMaxAgeMs;
      localStorage.removeItem(pendingKey);
      return null;
    }
    const capability = typeof parsed.capability === "string" ? parsed.capability : parsed.jobId;
    return typeof parsed.localId === "string" && typeof parsed.jobId === "string" && typeof capability === "string" && typeof parsed.createdAt === "string"
      ? { localId: parsed.localId, jobId: parsed.jobId, capability, createdAt: parsed.createdAt }
      : null;
  } catch {
    return null;
  }
}

export function consumePendingVisitorExpiryNotice(): boolean {
  const expired = pendingExpiredNotice;
  pendingExpiredNotice = false;
  return expired;
}

export function savePendingVisitorJob(job: PendingVisitorJob): void {
  localStorage.setItem(pendingKey, JSON.stringify(job));
}

export function clearPendingVisitorJob(jobId?: string): void {
  try {
    const current = readPendingVisitorJob();
    if (!jobId || current?.jobId === jobId) localStorage.removeItem(pendingKey);
  } catch {
    // Storage may be disabled; no credential is retained in that case.
  }
}
