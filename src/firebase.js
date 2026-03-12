import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAnZWVaSxO70161kMoQwmuPoFeORIXTXRI",
  authDomain: "tenisprofe-app.firebaseapp.com",
  projectId: "tenisprofe-app",
  storageBucket: "tenisprofe-app.firebasestorage.app",
  messagingSenderId: "34785838903",
  appId: "1:34785838903:web:16a546ae4806c878183cb2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
