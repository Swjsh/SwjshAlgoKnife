import { admin } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

/**
 * Middleware to verify Firebase ID tokens for protected API routes.
 */
export async function verifyAuth(request: Request) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { error: "Unauthorized: Missing Authorization header", status: 401 };
    }

    const token = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return { user: decodedToken };
    } catch (error) {
        console.error("Auth verification failed:", error);
        return { error: "Unauthorized: Invalid token", status: 401 };
    }
}
