'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsConfig {
    onApproveFirst?: () => void;
    onRejectFirst?: () => void;
    onApproveAll?: () => void;
    onClearSelection?: () => void;
    enabled?: boolean;
}

/**
 * Hook for keyboard shortcuts in the Activity Feed dashboard.
 *
 * Shortcuts:
 * - '1' = Approve first pending permission
 * - '2' = Reject first pending permission
 * - 'a' = Approve all pending permissions
 * - 'Escape' = Clear selection
 */
export function useKeyboardShortcuts({
    onApproveFirst,
    onRejectFirst,
    onApproveAll,
    onClearSelection,
    enabled = true,
}: KeyboardShortcutsConfig) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Skip if user is typing in an input field
            const target = event.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // Skip if modifier keys are pressed (allow browser shortcuts)
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            switch (event.key) {
                case '1':
                    event.preventDefault();
                    onApproveFirst?.();
                    break;

                case '2':
                    event.preventDefault();
                    onRejectFirst?.();
                    break;

                case 'a':
                case 'A':
                    event.preventDefault();
                    onApproveAll?.();
                    break;

                case 'Escape':
                    event.preventDefault();
                    onClearSelection?.();
                    break;
            }
        },
        [onApproveFirst, onRejectFirst, onApproveAll, onClearSelection]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, handleKeyDown]);
}

export default useKeyboardShortcuts;
