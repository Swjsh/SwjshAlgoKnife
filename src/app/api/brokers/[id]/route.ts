import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/brokers/[id] - Delete a broker configuration
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireUser();
        const { id } = await params;

        // Verify ownership
        const existingBroker = await prisma.brokerConfig.findUnique({
            where: { id },
        });

        if (!existingBroker || existingBroker.userId !== user.id) {
            return NextResponse.json(
                { error: 'Broker configuration not found' },
                { status: 404 }
            );
        }

        // Delete the broker config
        await prisma.brokerConfig.delete({
            where: { id },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'broker.delete',
                resourceType: 'BrokerConfig',
                resourceId: id,
                status: 'SUCCESS',
                metadata: {
                    broker: existingBroker.broker,
                    label: existingBroker.label,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/brokers/[id] error:', error);
        return NextResponse.json(
            { error: 'Failed to delete broker configuration' },
            { status: 500 }
        );
    }
}
