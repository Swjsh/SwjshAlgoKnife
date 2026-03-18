import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/onboarding/complete - Mark onboarding as completed
 */
export async function POST(req: NextRequest) {
    try {
        const user = await requireUser();

        // Update user onboarding status
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { onboardingStep: 'COMPLETED' },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'onboarding.complete',
                resourceType: 'User',
                resourceId: user.id,
                status: 'SUCCESS',
            },
        });

        return NextResponse.json({
            success: true,
            onboardingStep: updated.onboardingStep,
        });
    } catch (error) {
        console.error('POST /api/onboarding/complete error:', error);
        return NextResponse.json(
            { error: 'Failed to complete onboarding' },
            { status: 500 }
        );
    }
}
