// Server-side only Firebase Admin SDK
// DO NOT import this file in client components!

import * as admin from "firebase-admin";

// Initialize Admin SDK only on the server
if (typeof window === "undefined" && !admin.apps.length) {
    try {
        if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
                databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
            });
            console.log("Firebase Admin initialized.");
        } else {
            console.warn("FIREBASE_ADMIN_PRIVATE_KEY missing. Admin SDK not initialized.");
        }
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
    }
}

export { admin };
