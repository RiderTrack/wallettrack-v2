// ═══════════════════════════════════════════════════════════
// 🔥 FIREBASE — WalletTrack V2 (F1 · ACCESO)
// Proyecto: fittrack-e06be (el MISMO del FitTrack V2, reutilizado
// a propósito: Google ya está habilitado, la web config ya existe
// y tus cuentas son las mismas — WalletTrack vive en su PROPIA
// colección wallettrack_sync/{uid}, sin tocar los datos del
// FitTrack). Patrón idéntico al FitTrack V2: init modular
// Firebase 10, long polling dentro del APK (mejor performance en
// Android), login Google REAL (popup en web, plugin nativo APK).
// ═══════════════════════════════════════════════════════════

import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyArpeh_5hQqUIUnE19eQ-ClVeMnqhC0Zjs',
  authDomain: 'fittrack-e06be.firebaseapp.com',
  projectId: 'fittrack-e06be',
  storageBucket: 'fittrack-e06be.firebasestorage.app',
  messagingSenderId: '202098578518',
  appId: '1:202098578518:web:478894000ed30b9db017f7',
};

// Inicializar Firebase
let app;
let auth;
let db;
let storage;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);

  // Detectar APK (Capacitor) para usar long polling (mejor performance en Android)
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } else {
    db = getFirestore(app);
  }

  // F6 · Storage para comprobantes (mismo proyecto fittrack-e06be)
  storage = getStorage(app);
} catch (e) {
  console.error('Error inicializando Firebase:', e);
}

export { app, auth, db, storage };
export { GoogleAuthProvider };

// ═══════════════════════════════════════════════════════════
// 🔐 AUTENTICACIÓN — cableadas al LoginScreen (F1)
// ═══════════════════════════════════════════════════════════

// Login con Google (web - popup)
export async function loginConGoogleWeb() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Login con Google (APK - Capacitor GoogleAuth → idToken → credential)
export async function loginConGoogleAPK(googleUser: any) {
  try {
    // El idToken puede venir en diferentes ubicaciones según la versión del plugin
    const idToken = googleUser?.authentication?.idToken
      || googleUser?.idToken
      || googleUser?.authentication?.accessToken
      || googleUser?.accessToken;

    if (!idToken) {
      throw new Error('No se pudo obtener el token de Google');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return { success: true, user: result.user };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al conectar con Firebase' };
  }
}

// Cerrar sesión
export async function cerrarSesion() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Escuchar cambios de auth
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
