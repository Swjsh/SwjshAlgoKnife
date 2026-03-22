'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SidebarContextType {
    isCollapsed: boolean;
    toggleCollapsed: () => void;
    setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleCollapsed = useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

    const setCollapsed = useCallback((collapsed: boolean) => {
        setIsCollapsed(collapsed);
    }, []);

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleCollapsed, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
