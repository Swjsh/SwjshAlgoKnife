import React from 'react';
import { Bitcoin, DollarSign, Activity, Zap } from 'lucide-react';

interface TickerIconProps {
    type: string;
    className?: string;
}

export const TickerIcon: React.FC<TickerIconProps> = ({ type, className = "" }) => {
    const iconClass = `${className} opacity-90`;

    switch (type.toLowerCase()) {
        case 'crypto':
        case 'bitcoin':
        case 'btc/usd':
            return (
                <div className={`flex items-center justify-center bg-[#F7931A]/20 rounded-full w-5 h-5 ${className}`}>
                    <Bitcoin size={12} className="text-[#F7931A]" />
                </div>
            );
        case 'eth':
        case 'ethereum':
            return (
                <div className={`flex items-center justify-center bg-[#627EEA]/20 rounded-full w-5 h-5 ${className}`}>
                    <Zap size={12} className="text-[#627EEA]" />
                </div>
            );
        case 'forex':
        case 'eur/usd':
            return (
                <div className={`flex items-center justify-center bg-[#003399]/20 rounded-full w-5 h-5 ${className}`}>
                    <DollarSign size={12} className="text-[#60A5FA]" />
                </div>
            );
        case 'index':
        case 'spx500':
        case 'spx':
            return (
                <div className={`flex items-center justify-center bg-[#10B981]/20 rounded-full w-5 h-5 ${className}`}>
                    <Activity size={12} className="text-[#34D399]" />
                </div>
            );
        case 'doge':
            return (
                <div className={`flex items-center justify-center bg-[#BA9F33]/20 rounded-full w-5 h-5 ${className}`}>
                    <span className="text-[10px]">🌭</span>
                </div>
            );
        default:
            return (
                <div className={`flex items-center justify-center bg-gray-500/20 rounded-full w-5 h-5 ${className}`}>
                    <Activity size={12} className="text-gray-400" />
                </div>
            );
    }
};
