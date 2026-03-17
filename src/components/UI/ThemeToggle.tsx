"use client";

import React from 'react';
import { Moon, Sun, Leaf } from 'lucide-react';

interface ThemeToggleProps {
    theme: 'standard' | 'light' | 'nature';
    onToggle: () => void;
}

const themeConfig = {
    standard: {
        icon: <Moon size={18} />,
        label: 'Dark',
        nextLabel: 'Switch to Light Mode',
        bg: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#cbd5e1',
    },
    light: {
        icon: <Sun size={18} />,
        label: 'Light',
        nextLabel: 'Switch to Nature Mode',
        bg: 'rgba(124, 58, 237, 0.1)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        color: '#7c3aed',
    },
    nature: {
        icon: <Leaf size={18} />,
        label: 'Coffee',
        nextLabel: 'Switch to Dark Mode',
        bg: 'rgba(138, 152, 114, 0.2)',
        border: '1px solid #8a9872',
        color: '#8a9872',
    },
};

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
    const config = themeConfig[theme] ?? themeConfig.standard;

    return (
        <button
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: config.bg,
                border: config.border,
                borderRadius: '99px',
                color: config.color,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 600,
                fontSize: '0.9rem',
                backdropFilter: 'blur(10px)'
            }}
            title={config.nextLabel}
        >
            {config.icon}
            <span>{config.label}</span>
        </button>
    );
}
