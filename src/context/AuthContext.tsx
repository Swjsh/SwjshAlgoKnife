'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    User,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';

interface UserPreferences {
    theme: string;
    notifications: boolean;
    agents_view: string;
    accountBalance?: number;
    riskPerTrade?: number;
    onboardingComplete?: boolean;
    agentSetupComplete?: boolean;
    firstAgentConfig?: any;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    authLoading: boolean;
    authError: string | null;
    userPreferences: UserPreferences | null;
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    resetPassword: (email: string) => Promise<boolean>;
    updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

    // Helper to load or create user profile
    const loadOrCreateUserProfile = async (firebaseUser: User) => {
        console.log(`[AuthContext] Loading/creating profile for: ${firebaseUser.email} (${firebaseUser.uid})`);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('[AuthContext] Profile found, loading preferences.');
            setUserPreferences(data.preferences || null);
        } else {
            console.log('[AuthContext] No profile found. Creating default profile.');
            // Create profile for Google users (or any user missing a profile)
            const defaultPrefs: UserPreferences = {
                theme: 'dark',
                notifications: true,
                agents_view: 'standard',
                onboardingComplete: false
            };
            await setDoc(userDocRef, {
                email: firebaseUser.email,
                createdAt: serverTimestamp(),
                role: 'user',
                preferences: defaultPrefs
            });
            setUserPreferences(defaultPrefs);
            console.log('[AuthContext] Default profile created successfully.');
        }
    };

    useEffect(() => {
        // Set a timeout to prevent infinite loading - if auth doesn't respond in 8 seconds, proceed anyway
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn('Auth check timed out after 8 seconds');
                setLoading(false);
            }
        }, 8000);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeout);
            console.log('[AuthContext] Auth state changed:', firebaseUser ? 'Authenticated' : 'Unauthenticated');
            setUser(firebaseUser);

            if (firebaseUser) {
                // Race profile loading with a 4-second timeout so we don't block the app indefinitely
                const profilePromise = loadOrCreateUserProfile(firebaseUser);
                const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 4000));

                try {
                    await Promise.race([profilePromise, timeoutPromise]);
                } catch (err) {
                    console.error('Failed to load user profile (timeout or error):', err);
                    // Non-fatal: User is authenticated but preferences might be default
                }
            } else {
                setUserPreferences(null);
            }
            setLoading(false);
        });

        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    // Handle redirect result on mount
    useEffect(() => {
        const handleRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    // Successfully signed in via redirect
                    setAuthError(null);
                }
            } catch (error: unknown) {
                const err = error as { code?: string; message?: string };
                console.error('Redirect result error:', err);
                setAuthError(getErrorMessage(err.code));
            }
        };
        handleRedirectResult();
    }, []);

    const getErrorMessage = (errorCode?: string): string => {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            case 'auth/popup-blocked':
            case 'auth/popup-closed-by-user':
                return 'Authentication popup was blocked or closed.';
            default:
                return 'Authentication failed. Please try again.';
        }
    };

    const clearError = () => setAuthError(null);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        setAuthLoading(true);
        setAuthError(null);
        try {
            // Use redirect instead of popup to avoid COOP issues
            await signInWithRedirect(auth, provider);
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            console.error('Google login failed:', err);
            setAuthError(getErrorMessage(err.code));
            setAuthLoading(false);
        }
    };

    const loginWithEmail = async (email: string, password: string) => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            console.error('Email login failed:', err);
            setAuthError(getErrorMessage(err.code));
        } finally {
            setAuthLoading(false);
        }
    };

    const signUpWithEmail = async (email: string, password: string) => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            // Create persistent user profile in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                createdAt: serverTimestamp(),
                role: 'user',
                preferences: {
                    theme: 'dark',
                    notifications: true,
                    agents_view: 'standard',
                    onboardingComplete: false
                }
            });

        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            console.error('Email signup failed:', err);
            setAuthError(getErrorMessage(err.code));
        } finally {
            setAuthLoading(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAuthError(null);
            setUserPreferences(null);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const resetPassword = async (email: string): Promise<boolean> => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            console.error('Password reset failed:', err);
            setAuthError(getErrorMessage(err.code));
            return false;
        } finally {
            setAuthLoading(false);
        }
    };

    const updatePreferences = async (prefs: Partial<UserPreferences>) => {
        if (!user) return;

        // Optimistically update local state
        const newPrefs = { ...userPreferences, ...prefs } as UserPreferences;
        setUserPreferences(newPrefs);

        const userDocRef = doc(db, 'users', user.uid);

        try {
            await setDoc(userDocRef, { preferences: newPrefs }, { merge: true });
            console.log('[AuthContext] Preferences persisted to Firestore:', prefs);
        } catch (error) {
            console.error('Failed to update preferences in Firestore:', error);
            // Revert on error if necessary, but usually better to let the user retry or rely on the next refresh
            // For now, we keep the optimistic state unless it becomes a major issue
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            authLoading,
            authError,
            userPreferences,
            loginWithGoogle,
            loginWithEmail,
            signUpWithEmail,
            resetPassword,
            updatePreferences,
            logout,
            clearError
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
