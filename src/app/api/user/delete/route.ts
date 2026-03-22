import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, AuthError } from '@/lib/auth';
import { auth as firebaseAdminAuth } from 'firebase-admin';

// Schema for delete confirmation
const DeleteConfirmationSchema = z.object({
  confirmation: z.literal('DELETE'),
  reason: z.string().optional(),
});

/**
 * DELETE /api/user/delete
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * Requires the user to pass { "confirmation": "DELETE" } in the request body.
 *
 * This will delete:
 * - User profile
 * - All broker configurations
 * - All trading bots
 * - All trades and signals
 * - All journal entries
 * - All agent accounts and transactions
 * - All audit logs and legal acceptances
 * - The Firebase authentication account
 */
export async function DELETE(req: NextRequest) {
  try {
    // Require authenticated user
    const user = await requireUser();

    // Parse and validate request body
    const body = await req.json();
    const parseResult = DeleteConfirmationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid confirmation. Send { "confirmation": "DELETE" } to confirm account deletion.',
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const { reason } = parseResult.data;

    // Log the deletion attempt
    console.log(`[Account Deletion] User ${user.id} (${user.email}) requested deletion. Reason: ${reason || 'Not provided'}`);

    // Create final audit log entry before deletion
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user.delete',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {
          email: user.email,
          reason: reason || 'Not provided',
          requestedAt: new Date().toISOString(),
        },
        status: 'SUCCESS',
      },
    });

    // Get counts for response summary
    const [
      brokerCount,
      botCount,
      tradeCount,
      signalCount,
      journalCount,
      accountCount,
    ] = await Promise.all([
      prisma.brokerConfig.count({ where: { userId: user.id } }),
      prisma.bot.count({ where: { userId: user.id } }),
      prisma.trade.count({ where: { userId: user.id } }),
      prisma.signal.count({ where: { userId: user.id } }),
      prisma.journalEntry.count({ where: { userId: user.id } }),
      prisma.agentAccount.count({ where: { userId: user.id } }),
    ]);

    // Delete the Firebase user first
    let firebaseDeleted = false;
    try {
      await firebaseAdminAuth().deleteUser(user.externalId);
      firebaseDeleted = true;
      console.log(`[Account Deletion] Firebase user ${user.externalId} deleted`);
    } catch (firebaseError: any) {
      // Firebase deletion might fail if user already deleted or doesn't exist
      // Continue with Prisma deletion anyway
      console.warn(`[Account Deletion] Firebase deletion warning:`, firebaseError.message);
    }

    // Delete user from Prisma (cascades to all related records)
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log(`[Account Deletion] User ${user.id} (${user.email}) successfully deleted`);

    return NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.',
      summary: {
        brokerConfigsDeleted: brokerCount,
        botsDeleted: botCount,
        tradesDeleted: tradeCount,
        signalsDeleted: signalCount,
        journalEntriesDeleted: journalCount,
        agentAccountsDeleted: accountCount,
        firebaseAccountDeleted: firebaseDeleted,
      },
      deletedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Account Deletion] Error:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    // Don't expose internal errors
    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/delete
 *
 * Returns information about what will be deleted if the user proceeds.
 * Useful for showing a preview in the confirmation dialog.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();

    // Get counts of all data that will be deleted
    const [
      brokerCount,
      botCount,
      tradeCount,
      signalCount,
      journalCount,
      accountCount,
      auditCount,
      legalCount,
      settingCount,
      intelCount,
    ] = await Promise.all([
      prisma.brokerConfig.count({ where: { userId: user.id } }),
      prisma.bot.count({ where: { userId: user.id } }),
      prisma.trade.count({ where: { userId: user.id } }),
      prisma.signal.count({ where: { userId: user.id } }),
      prisma.journalEntry.count({ where: { userId: user.id } }),
      prisma.agentAccount.count({ where: { userId: user.id } }),
      prisma.auditLog.count({ where: { userId: user.id } }),
      prisma.legalAcceptance.count({ where: { userId: user.id } }),
      prisma.setting.count({ where: { userId: user.id } }),
      prisma.intelSignal.count({ where: { userId: user.id } }),
    ]);

    // Calculate total P&L from trades (for user awareness)
    const tradeStats = await prisma.trade.aggregate({
      where: { userId: user.id, status: 'CLOSED' },
      _sum: { realizedPnl: true },
      _count: true,
    });

    return NextResponse.json({
      user: {
        email: user.email,
        displayName: user.displayName,
        memberSince: user.createdAt,
      },
      dataToBeDeleted: {
        brokerConfigurations: brokerCount,
        tradingBots: botCount,
        trades: tradeCount,
        signals: signalCount,
        journalEntries: journalCount,
        agentAccounts: accountCount,
        auditLogs: auditCount,
        legalAcceptances: legalCount,
        settings: settingCount,
        intelSignals: intelCount,
      },
      tradingHistory: {
        totalTrades: tradeStats._count,
        totalRealizedPnl: tradeStats._sum.realizedPnl?.toNumber() ?? 0,
      },
      warning: 'This action is permanent and cannot be undone. All your data will be deleted.',
      confirmationRequired: 'Send DELETE request with { "confirmation": "DELETE" } to proceed.',
    });

  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('[Account Deletion Preview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account data' },
      { status: 500 }
    );
  }
}
