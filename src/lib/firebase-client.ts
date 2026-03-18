// src/lib/firebase-client.ts
// Client-side Firebase Authentication

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (client-side only)
let app: FirebaseApp;
let auth: Auth;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
}

export { auth };

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);

  // Get ID token and store in cookie
  const idToken = await userCredential.user.getIdToken();
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  return userCredential.user;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Get ID token and store in cookie
  const idToken = await userCredential.user.getIdToken();
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  return userCredential.user;
}

/**
 * Sign in with Google (popup)
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    const userCredential = await signInWithPopup(auth, provider);

    // Get ID token and store in cookie
    const idToken = await userCredential.user.getIdToken();
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    return userCredential.user;
  } catch (error: any) {
    // If popup is blocked, fall back to redirect
    if (error.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null; // User will be redirected
    }
    throw error;
  }
}

/**
 * Handle redirect result (call on page load)
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      // Get ID token and store in cookie
      const idToken = await result.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      return result.user;
    }
  } catch (error) {
    console.error('Redirect result error:', error);
    throw error;
  }
  return null;
}

/**
 * Sign out
 */
export async function signOut() {
  await firebaseSignOut(auth);

  // Clear session cookie
  await fetch('/api/auth/session', {
    method: 'DELETE',
  });
}

/**
 * Get current ID token (for API calls)
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  return await user.getIdToken();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string) {
  await firebaseSendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}/sign-in`,
    handleCodeInApp: false,
  });
}

/**
 * Verify password reset code
 */
export async function verifyResetCode(code: string) {
  return await verifyPasswordResetCode(auth, code);
}

/**
 * Confirm password reset with new password
 */
export async function confirmPasswordReset(code: string, newPassword: string) {
  await firebaseConfirmPasswordReset(auth, code, newPassword);
}
