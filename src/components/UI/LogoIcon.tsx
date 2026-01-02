import React from 'react';
import Image from 'next/image';

interface LogoIconProps {
    size?: number;
    className?: string;
    variant?: 'icon' | 'full';
}

export const LogoIcon = ({ size = 32, className = "", variant = 'icon' }: LogoIconProps) => {
    return (
        <Image
            src="/ak-logo.png"
            alt="Algo-Knife"
            width={size}
            height={size}
            className={className}
            style={{
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.4))'
            }}
        />
    );
};

// Full logo with Swjsh text
export const LogoFull = ({ height = 48, className = "" }: { height?: number, className?: string }) => {
    return (
        <Image
            src="/swjsh-ak-full.jpg"
            alt="Swjsh Algo-Knife"
            width={height * 2.5}
            height={height}
            className={className}
            style={{
                objectFit: 'contain',
                borderRadius: '8px'
            }}
        />
    );
};

// Corner watermark component
export const LogoWatermark = ({ position = 'bottom-right' }: { position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' }) => {
    const positionStyles: Record<string, React.CSSProperties> = {
        'bottom-right': { bottom: '20px', right: '20px' },
        'bottom-left': { bottom: '20px', left: '20px' },
        'top-right': { top: '20px', right: '20px' },
        'top-left': { top: '20px', left: '20px' },
    };

    return (
        <div style={{
            position: 'fixed',
            ...positionStyles[position],
            opacity: 0.15,
            pointerEvents: 'none',
            zIndex: 0,
        }}>
            <Image
                src="/ak-logo.png"
                alt=""
                width={60}
                height={60}
                style={{ objectFit: 'contain' }}
            />
        </div>
    );
};
