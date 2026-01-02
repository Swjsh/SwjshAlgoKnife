'use client';

import React from 'react';
import styles from './LogFilters.module.css';

interface LogFiltersProps {
    currentFilter: string;
    onFilterChange: (filter: string) => void;
    agents: { id: string; name: string }[];
}

export default function LogFilters({ currentFilter, onFilterChange, agents }: LogFiltersProps) {
    return (
        <div className={styles.filterContainer}>
            <div className={styles.filterGroup}>
                <div
                    className={`${styles.filterItem} ${currentFilter === 'all' ? styles.active : ''}`}
                    onClick={() => onFilterChange('all')}
                >
                    All Missions
                </div>
                <div
                    className={`${styles.filterItem} ${currentFilter === 'wins' ? styles.active : ''}`}
                    onClick={() => onFilterChange('wins')}
                >
                    Wins
                </div>
                <div
                    className={`${styles.filterItem} ${currentFilter === 'losses' ? styles.active : ''}`}
                    onClick={() => onFilterChange('losses')}
                >
                    Losses
                </div>
            </div>

            <div className={styles.filterGroup}>
                {agents.map(agent => (
                    <div
                        key={agent.id}
                        className={`${styles.filterItem} ${currentFilter === agent.id ? styles.active : ''}`}
                        onClick={() => onFilterChange(agent.id)}
                    >
                        {agent.name}
                    </div>
                ))}
            </div>
        </div>
    );
}
