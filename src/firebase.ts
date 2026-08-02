import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer, collection, getDocs, deleteDoc, setLogLevel, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

try {
  setLogLevel('silent');
} catch (e) {}

// Default Firebase configuration (AI Studio default project)
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyBi-69hlgDqb77ffmZwU4LN5FweUGDBB8Y",
  authDomain: "secret-diode-r8phd.firebaseapp.com",
  projectId: "secret-diode-r8phd",
  storageBucket: "secret-diode-r8phd.firebasestorage.app",
  messagingSenderId: "1064646478267",
  appId: "1:1064646478267:web:0759d198bc7aed36515c9e"
};

const DEFAULT_DB_ID = "ai-studio-c740c480-0e2f-414a-803c-2a2c9718abcc";

// Load custom config from localStorage if it exists
let firebaseConfig = DEFAULT_CONFIG;
let databaseId = DEFAULT_DB_ID;
let isCustomConfigUsed = false;

try {
  const customConfigStr = localStorage.getItem('abuzekry_custom_firebase_config');
  if (customConfigStr) {
    const custom = JSON.parse(customConfigStr);
    if (custom && custom.apiKey && custom.projectId) {
      firebaseConfig = {
        apiKey: custom.apiKey,
        authDomain: custom.authDomain || `${custom.projectId}.firebaseapp.com`,
        projectId: custom.projectId,
        storageBucket: custom.storageBucket || `${custom.projectId}.firebasestorage.app`,
        messagingSenderId: custom.messagingSenderId || "",
        appId: custom.appId || ""
      };
      databaseId = custom.databaseId || "(default)";
      isCustomConfigUsed = true;
    }
  }
} catch (e) {
  console.error("Error reading custom Firebase config:", e);
}

let app: any;
let db: any;
let auth: any;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, databaseId);
  auth = getAuth(app);
} catch (e) {
  console.error("Failed to initialize Firebase with custom/current config, falling back to default:", e);
  try {
    app = initializeApp(DEFAULT_CONFIG);
    db = getFirestore(app, DEFAULT_DB_ID);
    auth = getAuth(app);
    isCustomConfigUsed = false;
  } catch (err2) {
    console.error("Critical: Failed to initialize default Firebase:", err2);
  }
}

export { db, auth, isCustomConfigUsed };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Timeout utility to ensure offline clients or exhausted projects fail fast instead of hanging
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 12000, label: string = "Operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`تأخر استجابة الخادم السحابي (${label}) - تم حفظ جميع بياناتك محلياً 100% بأمان.`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Global Sync Status State
export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';
export interface SyncStateInfo {
  status: SyncStatusType;
  lastSyncTime: string;
  errorMessage?: string;
  pendingQueueCount: number;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = (error as any)?.code === 'resource-exhausted' || 
                  errMsg.includes('Quota limit exceeded') || 
                  errMsg.includes('resource-exhausted') || 
                  errMsg.includes('Quota exceeded') || 
                  errMsg.includes('quota metric');

  if (isQuota) {
    localStorage.setItem('abuzekry_firebase_quota_exceeded', 'true');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_quota_exceeded', {
        detail: { message: 'تم استنفاذ الحصة اليومية المجانية للكتابة السحابية (Quota Exceeded)' }
      }));
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: isQuota ? 'تم استنفاذ الحصة اليومية المجانية للكتابة السحابية (Quota Exceeded)' : errMsg,
    authInfo: {
      userId: auth && auth.currentUser ? auth.currentUser.uid : null,
      email: auth && auth.currentUser ? auth.currentUser.email : null,
      emailVerified: auth && auth.currentUser ? auth.currentUser.emailVerified : null,
      isAnonymous: auth && auth.currentUser ? auth.currentUser.isAnonymous : null,
      tenantId: auth && auth.currentUser ? auth.currentUser.tenantId : null,
      providerInfo: auth && auth.currentUser && auth.currentUser.providerData ? auth.currentUser.providerData.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) : []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Offline/Delayed: ', JSON.stringify(errInfo));
  localStorage.setItem('abuzekry_firebase_offline_state', 'true');
  localStorage.setItem('abuzekry_firebase_last_error', errInfo.error);
}

// Validate Connection to Firestore
export async function testConnection(ignoreQuota: boolean = false): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    localStorage.setItem('abuzekry_firebase_offline_state', 'true');
    return false;
  }

  if (!ignoreQuota && localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    return false;
  }

  try {
    // We use a collection that we have permission to read (abuzekry_realtime) to avoid Permission Denied errors
    await withTimeout(getDocFromServer(doc(db, 'abuzekry_realtime', 'connection_test')), 6000, "اختبار الاتصال");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    return true;
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isQuota = (error as any)?.code === 'resource-exhausted' || 
                    errMsg.includes('Quota limit exceeded') || 
                    errMsg.includes('resource-exhausted') || 
                    errMsg.includes('Quota exceeded') || 
                    errMsg.includes('quota metric');
    if (isQuota) {
      localStorage.setItem('abuzekry_firebase_quota_exceeded', 'true');
      return false;
    }

    // If the error code is permission-denied or unauthenticated, it means we successfully reached the server (so we are online)
    if (error && (error.code === 'permission-denied' || error.code === 'unauthenticated' || String(error).includes('permission'))) {
      localStorage.setItem('abuzekry_firebase_offline_state', 'false');
      return true;
    }
    console.warn("Firebase testing failed:", error);
    localStorage.setItem('abuzekry_firebase_offline_state', 'true');
    return false;
  }
}

// Delta Sync & Fingerprinting Helpers
export function computeEntityHash(data: any): string {
  if (data === null || data === undefined) return 'null';
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return `${str.length}_${(hash >>> 0).toString(16)}`;
  } catch (e) {
    return String(Math.random());
  }
}

export function getSyncedHash(entityKey: string): string | null {
  try {
    return localStorage.getItem(`abuzekry_synced_hash_${entityKey}`);
  } catch (e) {
    return null;
  }
}

export function setSyncedHash(entityKey: string, hash: string): void {
  try {
    localStorage.setItem(`abuzekry_synced_hash_${entityKey}`, hash);
  } catch (e) {
    console.error("Error setting synced hash:", e);
  }
}

export function getItemHashes(entityKey: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`abuzekry_item_hashes_${entityKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setItemHashes(entityKey: string, hashes: Record<string, string>): void {
  try {
    localStorage.setItem(`abuzekry_item_hashes_${entityKey}`, JSON.stringify(hashes));
  } catch (e) {
    console.error("Error saving item hashes:", e);
  }
}

// Queue Management for Offline Writes
export interface QueueItem {
  id: string;
  entityKey: string;
  data: any;
  hash?: string;
  timestamp: string;
}

export function getPendingQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem('abuzekry_pending_sync_queue');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePendingQueue(queue: QueueItem[]) {
  try {
    localStorage.setItem('abuzekry_pending_sync_queue', JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
    }
  } catch (e) {
    console.error("Error saving pending sync queue:", e);
  }
}

export function clearPendingQueue(): void {
  try {
    localStorage.removeItem('abuzekry_pending_sync_queue');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
      window.dispatchEvent(new CustomEvent('abuzekry_sync_completed'));
    }
  } catch (e) {
    console.error("Error clearing pending queue:", e);
  }
}

export function removeFromPendingQueue(id: string): void {
  try {
    const queue = getPendingQueue();
    const filtered = queue.filter(item => item.id !== id && item.entityKey !== id);
    savePendingQueue(filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
    }
  } catch (e) {
    console.error("Error removing item from pending queue:", e);
  }
}

export function addToSyncQueue(entityKey: string, data: any) {
  const newHash = computeEntityHash(data);
  const lastSyncedHash = getSyncedHash(entityKey);

  // Delta Sync check: If data hash matches the cloud synced hash and there's no pending item, skip queuing!
  if (lastSyncedHash === newHash) {
    const currentQueue = getPendingQueue();
    const existingInQueue = currentQueue.find(q => q.entityKey === entityKey);
    if (!existingInQueue) {
      console.log(`[DeltaSync] Entity '${entityKey}' hash (${newHash}) matches cloud. Skipping redundant sync.`);
      return;
    }
  }

  const queue = getPendingQueue();
  // Remove existing item for same entity to avoid duplicate writes
  const filtered = queue.filter(item => item.entityKey !== entityKey);
  filtered.push({
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    entityKey,
    data,
    hash: newHash,
    timestamp: new Date().toISOString()
  });
  savePendingQueue(filtered);
  
  // Dispatch custom event to notify components that sync has been queued
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('abuzekry_sync_started', {
      detail: { entityKey, count: filtered.length }
    }));
  }
  
  // Trigger async background processing if quota is not exceeded
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_quota_exceeded', {
        detail: { message: 'تم الحفظ محلياً بأمان (استنفاذ الحصة السحابية اليومية)' }
      }));
    }
  } else {
    processSyncQueue().catch(() => {});
  }
}

let isProcessingQueue = false;
export async function processSyncQueue(force: boolean = false): Promise<void> {
  if (isProcessingQueue) return;
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  isProcessingQueue = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('abuzekry_sync_processing', {
      detail: { count: queue.length }
    }));
  }
  console.log(`Processing Firebase Sync queue (${queue.length} items, force=${force})...`);

  try {
    if (!force) {
      if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
        isProcessingQueue = false;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('abuzekry_sync_quota_exceeded', {
            detail: { message: 'تم استنفاذ الحصة السحابية اليومية للمشروع (Quota Exceeded)' }
          }));
        }
        return;
      }
      const online = await testConnection();
      if (!online) {
        isProcessingQueue = false;
        if (typeof window !== 'undefined') {
          const isUserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
            detail: { 
              message: isUserOffline 
                ? 'الجهاز غير متصل بالإنترنت - تم حفظ التعديلات محلياً بأمان' 
                : 'خادم المزامنة السحابية مؤجل الاستجابة - تم حفظ كافة التعديلات محلياً بأمان' 
            }
          }));
        }
        return;
      }
    }

    // Consolidate items by entityKey to ensure atomic latest-snapshot updates
    const entityMap = new Map<string, QueueItem>();
    for (const item of queue) {
      entityMap.set(item.entityKey, item);
    }

    let failCount = 0;
    let isQuotaExceeded = false;

    for (const [entityKey, item] of entityMap.entries()) {
      try {
        const isArrayData = Array.isArray(item.data) && (item.data.length === 0 || item.data[0]?.id !== undefined);

        if (isArrayData) {
          const itemsArray = item.data as any[];
          const currentMap = new Map<string, { obj: any; hash: string }>();
          const currentHashesRecord: Record<string, string> = {};

          for (const obj of itemsArray) {
            if (obj && obj.id !== undefined && obj.id !== null) {
              const idStr = String(obj.id);
              const h = computeEntityHash(obj);
              currentMap.set(idStr, { obj, hash: h });
              currentHashesRecord[idStr] = h;
            }
          }

          let lastHashes = getItemHashes(entityKey);

          // If lastHashes is missing or null, query remote items subcollection to detect deleted items
          if (lastHashes === null) {
            try {
              const subCollRef = collection(db, "abuzekry_realtime", entityKey, "items");
              const subSnap = await withTimeout(getDocs(subCollRef), 8000, `جلب معرفات ${entityKey}`);
              lastHashes = {};
              if (subSnap && !subSnap.empty) {
                subSnap.docs.forEach(docSnap => {
                  const docData = docSnap.data();
                  lastHashes![docSnap.id] = computeEntityHash(docData);
                });
              }
            } catch (e) {
              console.warn(`Could not fetch remote doc IDs for ${entityKey}, defaulting:`, e);
              lastHashes = {};
            }
          }

          // Calculate item-level deltas (modified and deleted)
          const modifiedItems: any[] = [];
          for (const [idStr, entry] of currentMap.entries()) {
            if (lastHashes[idStr] !== entry.hash) {
              modifiedItems.push(entry.obj);
            }
          }

          const deletedIds: string[] = [];
          for (const oldId of Object.keys(lastHashes)) {
            if (!currentMap.has(oldId)) {
              deletedIds.push(oldId);
            }
          }

          if (modifiedItems.length === 0 && deletedIds.length === 0) {
            console.log(`[DeltaSync] '${entityKey}': 0 modified or deleted items. Skipping network write.`);
            const successHash = item.hash || computeEntityHash(item.data);
            setSyncedHash(entityKey, successHash);
            setItemHashes(entityKey, currentHashesRecord);
            const updatedQueue = getPendingQueue().filter(q => q.entityKey !== entityKey);
            savePendingQueue(updatedQueue);
            continue;
          }

          console.log(`[DeltaSync] '${entityKey}': Writing ${modifiedItems.length} modified items and deleting ${deletedIds.length} items (Total: ${itemsArray.length}).`);

          const ops: Array<{ type: 'set' | 'delete'; id: string; data?: any }> = [
            ...modifiedItems.map(m => ({ type: 'set' as const, id: String(m.id), data: m })),
            ...deletedIds.map(d => ({ type: 'delete' as const, id: d }))
          ];

          // Perform batched writes in chunks of 400
          for (let i = 0; i < ops.length; i += 400) {
            const chunk = ops.slice(i, i + 400);
            const batch = writeBatch(db);
            for (const op of chunk) {
              const itemRef = doc(db, "abuzekry_realtime", entityKey, "items", op.id);
              if (op.type === 'set') {
                batch.set(itemRef, op.data);
              } else {
                batch.delete(itemRef);
              }
            }
            await withTimeout(batch.commit(), 12000, `مزامنة تفاضلية ${entityKey}`);
          }

          // Update main doc metadata
          const docRef = doc(db, "abuzekry_realtime", entityKey);
          await withTimeout(setDoc(docRef, {
            updatedAt: item.timestamp || new Date().toISOString(),
            count: itemsArray.length,
            items: itemsArray.length <= 100 ? itemsArray : []
          }, { merge: true }), 5000, `تحديث مؤشر ${entityKey}`);

          setItemHashes(entityKey, currentHashesRecord);
        } else {
          // Standard single doc sync for non-array entities
          const docRef = doc(db, "abuzekry_realtime", entityKey);
          await withTimeout(setDoc(docRef, {
            items: item.data,
            updatedAt: item.timestamp || new Date().toISOString()
          }), 10000, `مزامنة ${entityKey}`);
        }

        // Success - update hash & remove from local queue
        const successHash = item.hash || computeEntityHash(item.data);
        setSyncedHash(entityKey, successHash);

        const updatedQueue = getPendingQueue().filter(q => q.entityKey !== entityKey);
        savePendingQueue(updatedQueue);
        localStorage.removeItem('abuzekry_firebase_quota_exceeded');
      } catch (err: any) {
        console.warn(`Failed to process sync item for ${entityKey}:`, err);
        failCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        const quotaError = err?.code === 'resource-exhausted' || 
                           errMsg.includes('Quota limit exceeded') || 
                           errMsg.includes('resource-exhausted') || 
                           errMsg.includes('Quota exceeded') ||
                           errMsg.includes('quota metric');
        if (quotaError) {
          isQuotaExceeded = true;
          localStorage.setItem('abuzekry_firebase_quota_exceeded', 'true');
          // Abort further attempts in this loop to avoid hitting quota backoff repeatedly
          break;
        }
      }
    }

    localStorage.setItem('abuzekry_firebase_offline_state', failCount > 0 ? 'true' : 'false');
  } catch (e) {
    console.error("Error in processSyncQueue:", e);
  } finally {
    isProcessingQueue = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
      const remaining = getPendingQueue().length;
      if (remaining === 0) {
        localStorage.removeItem('abuzekry_firebase_quota_exceeded');
        window.dispatchEvent(new CustomEvent('abuzekry_sync_completed'));
      } else if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
        window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
          detail: { message: `تم استنفاذ الحصة السحابية اليومية (Quota Exceeded) - متبقي ${remaining} تعديلات محفوظة محلياً` }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
          detail: { message: `متبقي ${remaining} عمليات محفوظة محلياً بأمان بانتظار استجابة الخادم السحابي` }
        }));
      }
    }
  }
}

function recordArrayItemHashes(entityKey: string, itemsArray: any[]) {
  if (Array.isArray(itemsArray)) {
    const record: Record<string, string> = {};
    itemsArray.forEach(item => {
      if (item && item.id !== undefined) {
        record[String(item.id)] = computeEntityHash(item);
      }
    });
    setItemHashes(entityKey, record);
    setSyncedHash(entityKey, computeEntityHash(itemsArray));
  }
}

// Helper to push full local backup to Firebase
export async function uploadBackupToFirebase(data: any): Promise<void> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    throw new Error('تم استنفاذ الحصة السحابية اليومية المجانية للمشروع (Quota Exceeded). جميع بياناتك محفوظة محلياً بأمان.');
  }

  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    await withTimeout(setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }), 25000, "رفع نسخة احتياطية كاملة");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    localStorage.removeItem('abuzekry_firebase_quota_exceeded');

    // Record synced hashes for all entities uploaded in main backup
    if (data) {
      if (data.students) recordArrayItemHashes('students', data.students);
      if (data.groups) recordArrayItemHashes('groups', data.groups);
      if (data.payments) recordArrayItemHashes('payments', data.payments);
      if (data.attendance) recordArrayItemHashes('attendance', data.attendance);
      if (data.exams) recordArrayItemHashes('exams', data.exams);
      if (data.examScores) recordArrayItemHashes('examScores', data.examScores);
      if (data.templates) recordArrayItemHashes('templates', data.templates);
      if (data.prices) setSyncedHash('prices', computeEntityHash(data.prices));
      if (data.registrationSettings) setSyncedHash('registration_settings', computeEntityHash(data.registrationSettings));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

// Helper to download full backup from Firebase
export async function downloadBackupFromFirebase(): Promise<any | null> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    return null;
  }
  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    const docSnap = await withTimeout(getDoc(docRef), 20000, "تنزيل نسخة احتياطية كاملة");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    if (docSnap.exists()) {
      const backupData = docSnap.data();
      if (backupData) {
        if (backupData.students) recordArrayItemHashes('students', backupData.students);
        if (backupData.groups) recordArrayItemHashes('groups', backupData.groups);
        if (backupData.payments) recordArrayItemHashes('payments', backupData.payments);
        if (backupData.attendance) recordArrayItemHashes('attendance', backupData.attendance);
        if (backupData.exams) recordArrayItemHashes('exams', backupData.exams);
        if (backupData.examScores) recordArrayItemHashes('examScores', backupData.examScores);
        if (backupData.templates) recordArrayItemHashes('templates', backupData.templates);
        if (backupData.prices) setSyncedHash('prices', computeEntityHash(backupData.prices));
        if (backupData.registrationSettings) setSyncedHash('registration_settings', computeEntityHash(backupData.registrationSettings));
      }
      return backupData;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

let syncDebounceTimer: any = null;

// Single item updater helper to write individual updates immediately or via debounced queue
export async function syncEntityToFirebase(entityKey: string, data: any): Promise<void> {
  // Add to local queue first (supports offline-first immediately)
  addToSyncQueue(entityKey, data);
  
  // If quota is already exceeded, keep item safely in local queue without triggering network write errors
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
        detail: { message: 'تم الحفظ محلياً بأمان (استنفاذ الحصة السحابية اليومية)' }
      }));
    }
    return;
  }

  // Debounce background flush by 1.5s to batch rapid consecutive changes into a single write call
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    processSyncQueue().catch(() => {});
  }, 1500);
}

// Fetch individual entity from Firebase
export async function fetchEntityFromFirebase(entityKey: string): Promise<any | null> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    return null;
  }
  const path = `abuzekry_realtime/${entityKey}`;
  try {
    // 1. Try fetching from subcollection first (for granular items)
    const subCollRef = collection(db, "abuzekry_realtime", entityKey, "items");
    const subSnap = await withTimeout(getDocs(subCollRef), 8000, `جلب ${entityKey}`);
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');

    if (subSnap && !subSnap.empty) {
      const items = subSnap.docs.map(d => d.data());
      const currentHashesRecord: Record<string, string> = {};
      items.forEach(obj => {
        if (obj && obj.id !== undefined) {
          currentHashesRecord[String(obj.id)] = computeEntityHash(obj);
        }
      });
      setItemHashes(entityKey, currentHashesRecord);
      setSyncedHash(entityKey, computeEntityHash(items));
      return { items, updatedAt: new Date().toISOString() };
    }

    // 2. Fallback to main single document (for legacy or non-array data)
    const docRef = doc(db, "abuzekry_realtime", entityKey);
    const docSnap = await withTimeout(getDoc(docRef), 5000, `جلب ${entityKey}`);
    if (docSnap.exists()) {
      const entityData = docSnap.data();
      if (entityData) {
        if (entityData.items !== undefined) {
          setSyncedHash(entityKey, computeEntityHash(entityData.items));
        }
        if (entityData.count === 0 || (Array.isArray(entityData.items) && entityData.items.length === 0)) {
          setItemHashes(entityKey, {});
          setSyncedHash(entityKey, computeEntityHash([]));
          return { items: [], updatedAt: entityData.updatedAt || new Date().toISOString() };
        }
        return entityData;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  return null;
}

// Listen to online events to automatically flush the queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("Device is online. Flushing Firebase sync queue...");
    processSyncQueue().catch(() => {});
  });

  // Periodically process queue every 45 seconds if pending items exist
  setInterval(() => {
    if (getPendingQueue().length > 0 && localStorage.getItem('abuzekry_firebase_quota_exceeded') !== 'true') {
      processSyncQueue().catch(() => {});
    }
  }, 45000);
}

// Public self-registration isolated helpers
export async function submitPublicRegistration(registration: any): Promise<void> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    throw new Error('تم استنفاذ الحصة السحابية اليومية للتسجيل (Quota Exceeded). يرجى المحاولة غداً.');
  }
  try {
    const regId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, "abuzekry_public_registrations", regId);
    await setDoc(docRef, {
      ...registration,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "abuzekry_public_registrations");
    console.error("Failed to submit public registration to firestore:", err);
    throw err;
  }
}

export async function fetchPublicRegistrations(): Promise<any[]> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    return [];
  }
  try {
    const colRef = collection(db, "abuzekry_public_registrations");
    const querySnap = await getDocs(colRef);
    const results: any[] = [];
    querySnap.forEach((docSnap) => {
      results.push({
        _docId: docSnap.id,
        ...docSnap.data()
      });
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "abuzekry_public_registrations");
    console.error("Failed to fetch public registrations from firestore:", err);
    return [];
  }
}

export async function deletePublicRegistration(docId: string): Promise<void> {
  if (localStorage.getItem('abuzekry_firebase_quota_exceeded') === 'true') {
    return;
  }
  try {
    const docRef = doc(db, "abuzekry_public_registrations", docId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `abuzekry_public_registrations/${docId}`);
    console.error("Failed to delete public registration from firestore:", err);
  }
}


