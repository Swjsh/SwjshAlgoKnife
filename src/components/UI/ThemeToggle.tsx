"use client";

import React from 'react';
import { Moon, Leaf } from 'lucide-react';

interface ThemeToggleProps {
    theme: 'standard' | 'nature';
    onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
    return (
        <button
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: theme === 'nature'
                    ? 'rgba(138, 152, 114, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
                border: theme === 'nature'
                    ? '1px solid #8a9872'
                    : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '99px',
                color: theme === 'nature' ? '#8a9872' : '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 600,
                fontSize: '0.9rem',
                backdropFilter: 'blur(10px)'
            }}
            title={theme === 'nature' ? "Switch to Dark Mode" : "Switch to Nature Mode"}
        >
            {theme === 'standard' ? (
                <>
                    <Moon size={18} />
                    <span>Dark</span>
                </>
            ) : (
                <>
                    <Leaf size={18} />
                    <span>Coffee</span>
                </>
            )}
        </button>
    );
}
