import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './BentoItem.module.css';

interface BentoItemProps {
    className?: string;
    children: ReactNode;
}

// Reusable BentoItem for the Blueprint theme.
const BentoItem = ({ className, children }: BentoItemProps) => {
    return (
        <div className={cn(styles.bentoItem, className)}>
            {/* Corner brackets for the holographic effect */}
            <div className={cn(styles.corner, styles.topLeft)}></div>
            <div className={cn(styles.corner, styles.topRight)}></div>
            <div className={cn(styles.corner, styles.bottomLeft)}></div>
            <div className={cn(styles.corner, styles.bottomRight)}></div>
            <div className={styles.contentWrapper}>
                {children}
            </div>
        </div>
    );
};

export default BentoItem;
