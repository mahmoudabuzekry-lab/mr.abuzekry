import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3500, label: string = "Operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`انتهت مهلة الاتصال (${label}) - يبدو أن العميل غير متصل أو تم استهلاك الحصة المجانية للمشروع.`));
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
export async function testConnection(): Promise<boolean> {
  try {
    await withTimeout(getDocFromServer(doc(db, 'test', 'connection')), 2500, "اختبار الاتصال");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    return true;
  } catch (error) {
    console.warn("Firebase testing failed:", error);
    localStorage.setItem('abuzekry_firebase_offline_state', 'true');
    return false;
  }
}

// Queue Management for Offline Writes
export interface QueueItem {
  id: string;
  entityKey: string;
  data: any;
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
  } catch (e) {
    console.error("Error saving pending sync queue:", e);
  }
}

export function addToSyncQueue(entityKey: string, data: any) {
  const queue = getPendingQueue();
  // Remove existing item for same entity to avoid duplicate writes
  const filtered = queue.filter(item => item.entityKey !== entityKey);
  filtered.push({
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    entityKey,
    data,
    timestamp: new Date().toISOString()
  });
  savePendingQueue(filtered);
  
  // Dispatch custom event to notify components that sync has been queued
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('abuzekry_sync_started', {
      detail: { entityKey, count: filtered.length }
    }));
  }
  
  // Trigger async background processing
  processSyncQueue().catch(() => {});
}

let isProcessingQueue = false;
export async function processSyncQueue(): Promise<void> {
  if (isProcessingQueue) return;
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  isProcessingQueue = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('abuzekry_sync_processing', {
      detail: { count: queue.length }
    }));
  }
  console.log(`Processing Firebase Sync queue (${queue.length} items)...`);

  try {
    // Verify connection first before attempting writes
    const online = await testConnection();
    if (!online) {
      isProcessingQueue = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
          detail: { message: 'تعذر الاتصال بالإنترنت - سيتم ترحيل البيانات لاحقاً تلقائياً' }
        }));
      }
      return;
    }

    // Process items one by one
    const currentQueue = [...queue];
    for (const item of currentQueue) {
      try {
        const docRef = doc(db, "abuzekry_realtime", item.entityKey);
        await withTimeout(setDoc(docRef, {
          items: item.data,
          updatedAt: item.timestamp
        }), 4000, `مزامنة ${item.entityKey}`);

        // Remove from local queue
        const updatedQueue = getPendingQueue().filter(q => q.id !== item.id);
        savePendingQueue(updatedQueue);
      } catch (err) {
        console.warn(`Failed to process sync item for ${item.entityKey}, will retry later:`, err);
        // Stop processing this run if there is a connection failure during execution
        break;
      }
    }
  } catch (e) {
    console.error("Error in processSyncQueue:", e);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
        detail: { message: 'حدث خطأ أثناء مزامنة البيانات السحابية' }
      }));
    }
  } finally {
    isProcessingQueue = false;
    // Dispatch custom event to notify components of queue update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
      const remaining = getPendingQueue().length;
      if (remaining === 0) {
        window.dispatchEvent(new CustomEvent('abuzekry_sync_completed'));
      } else {
        window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
          detail: { message: `متبقي ${remaining} عمليات معلقة لعدم استقرار الشبكة` }
        }));
      }
    }
  }
}

// Helper to push full local backup to Firebase
export async function uploadBackupToFirebase(data: any): Promise<void> {
  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    await withTimeout(setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }), 5000, "رفع نسخة احتياطية كاملة");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

// Helper to download full backup from Firebase
export async function downloadBackupFromFirebase(): Promise<any | null> {
  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    const docSnap = await withTimeout(getDoc(docRef), 5000, "تنزيل نسخة احتياطية كاملة");
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

// Single item updater helper to write individual updates immediately
export async function syncEntityToFirebase(entityKey: string, data: any): Promise<void> {
  const path = `abuzekry_realtime/${entityKey}`;
  
  // Add to local queue first (supports offline-first immediately)
  addToSyncQueue(entityKey, data);
  
  try {
    const docRef = doc(db, "abuzekry_realtime", entityKey);
    await withTimeout(setDoc(docRef, {
      items: data,
      updatedAt: new Date().toISOString()
    }), 3500, `حفظ ${entityKey}`);

    // If successful, remove from the queue
    const queue = getPendingQueue().filter(item => item.entityKey !== entityKey);
    savePendingQueue(queue);
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_status_updated'));
      window.dispatchEvent(new CustomEvent('abuzekry_sync_completed'));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('abuzekry_sync_failed', {
        detail: { message: 'تم الحفظ محلياً (أوفلاين)' }
      }));
    }
  }
}

// Fetch individual entity from Firebase
export async function fetchEntityFromFirebase(entityKey: string): Promise<any | null> {
  const path = `abuzekry_realtime/${entityKey}`;
  try {
    const docRef = doc(db, "abuzekry_realtime", entityKey);
    const docSnap = await withTimeout(getDoc(docRef), 4000, `جلب ${entityKey}`);
    localStorage.setItem('abuzekry_firebase_offline_state', 'false');
    if (docSnap.exists()) {
      return docSnap.data();
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
    if (getPendingQueue().length > 0) {
      processSyncQueue().catch(() => {});
    }
  }, 45000);
}

