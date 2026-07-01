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
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.warn(
      "ملاحظة حول الاتصال بـ Firebase: لم يتمكن التطبيق من الاتصال بقاعدة البيانات السحابية الافتراضية (قد يكون ذلك بسبب انتهاء حد الاستخدام المجاني للمشروع المشترك، أو عدم وجود اتصال بالإنترنت). يمكنك ربط مشروعك الخاص المستقل مجاناً من صفحة النسخ الاحتياطي ومزامنة البيانات لتجنب أي قيود.",
      error
    );
  }
}
testConnection();

// Helper to push full local backup to Firebase
export async function uploadBackupToFirebase(data: any): Promise<void> {
  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Helper to download full backup from Firebase
export async function downloadBackupFromFirebase(): Promise<any | null> {
  const path = "abuzekry_data/main_backup";
  try {
    const docRef = doc(db, "abuzekry_data", "main_backup");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

// Single item updater helper to write individual updates immediately
export async function syncEntityToFirebase(entityKey: string, data: any): Promise<void> {
  const path = `abuzekry_realtime/${entityKey}`;
  try {
    const docRef = doc(db, "abuzekry_realtime", entityKey);
    await setDoc(docRef, {
      items: data,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch individual entity from Firebase
export async function fetchEntityFromFirebase(entityKey: string): Promise<any | null> {
  const path = `abuzekry_realtime/${entityKey}`;
  try {
    const docRef = doc(db, "abuzekry_realtime", entityKey);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  return null;
}
