// src/firebase.js
import { getApps, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <--- NEW: Import getFirestore

const firebaseConfig = {
  apiKey: "AIzaSyDIbILta_P2Xr64I0_owTlg9ekx5Ve7yPg",
  authDomain: "medizap-f8bcf.firebaseapp.com",
  projectId: "medizap-f8bcf",
  storageBucket: "medizap-f8bcf.firebasestorage.app",
  messagingSenderId: "269199226286",
  appId: "1:269199226286:web:3f3ea0406d274bd0d7843f",
  measurementId: "G-80ZFM572L1",
};

// ✅ Initialize Firebase (only once)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// ✅ Initialize services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app); // <--- NEW: Initialize Firestore

// ✅ Export instances
export { analytics, app, auth, db }; // <--- MODIFIED: Export 'db' here