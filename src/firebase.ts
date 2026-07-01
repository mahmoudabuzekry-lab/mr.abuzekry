import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBi-69hlgDqb77ffmZwU4LN5FweUGDBB8Y",
  authDomain: "secret-diode-r8phd.firebaseapp.com",
  projectId: "secret-diode-r8phd",
  storageBucket: "secret-diode-r8phd.firebasestorage.app",
  messagingSenderId: "1064646478267",
  appId: "1:1064646478267:web:0759d198bc7aed36515c9e"
};

const app = initializeApp(firebaseConfig);

// Use the specific firestore database ID from the config
const db = getFirestore(app, "ai-studio-c740c480-0e2f-414a-803c-2a2c9718abcc");
const auth = getAuth(app);

export { db, auth };

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
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
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
