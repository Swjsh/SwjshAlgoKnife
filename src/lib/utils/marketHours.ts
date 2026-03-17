/**
 * Market Hours Utility
 * Determines if markets are open and calculates time until next open
 */

export interface MarketStatus {
    isOpen: boolean;
    nextOpen: Date | null;
    nextClose: Date | null;
    timeUntilChange: string;
}

export function getMarketStatus(marketType: string): MarketStatus {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes; // Minutes since midnight

    let isOpen = false;
    let nextOpen: Date | null = null;
    let nextClose: Date | null = null;

    switch (marketType.toLowerCase()) {
        case 'forex':
            // Forex: Sunday 5pm ET - Friday 5pm ET
            if (day === 0) {
                // Sunday
                isOpen = currentTime >= 17 * 60; // After 5pm
                if (!isOpen) {
                    nextOpen = new Date(now);
                    nextOpen.setHours(17, 0, 0, 0);
                }
            } else if (day === 6) {
                // Saturday - closed all day
                isOpen = false;
                nextOpen = new Date(now);
                nextOpen.setDate(now.getDate() + (7 - day)); // Next Sunday
                nextOpen.setHours(17, 0, 0, 0);
            } else if (day === 5) {
                // Friday
                isOpen = currentTime < 17 * 60; // Before 5pm
                if (isOpen) {
                    nextClose = new Date(now);
                    nextClose.setHours(17, 0, 0, 0);
                }
            } else {
                // Monday-Thursday
                isOpen = true;
            }
            break;

        case 'futures':
        case 'options':
            // US Stock Market: Mon-Fri 9:30am - 4pm ET
            if (day === 0 || day === 6) {
                // Weekend
                isOpen = false;
                const daysUntilMonday = day === 0 ? 1 : 2;
                nextOpen = new Date(now);
                nextOpen.setDate(now.getDate() + daysUntilMonday);
                nextOpen.setHours(9, 30, 0, 0);
            } else {
                // Weekday
                const marketOpen = 9 * 60 + 30; // 9:30am
                const marketClose = 16 * 60; // 4:00pm

                isOpen = currentTime >= marketOpen && currentTime < marketClose;

                if (currentTime < marketOpen) {
                    nextOpen = new Date(now);
                    nextOpen.setHours(9, 30, 0, 0);
                } else if (currentTime >= marketClose) {
                    nextOpen = new Date(now);
                    nextOpen.setDate(now.getDate() + 1);
                    nextOpen.setHours(9, 30, 0, 0);
                    // Skip weekend
                    if (nextOpen.getDay() === 6) nextOpen.setDate(nextOpen.getDate() + 2);
                    if (nextOpen.getDay() === 0) nextOpen.setDate(nextOpen.getDate() + 1);
                } else {
                    nextClose = new Date(now);
                    nextClose.setHours(16, 0, 0, 0);
                }
            }
            break;

        case 'crypto':
        case 'crypto (paused)':
            // Crypto: 24/7
            isOpen = true;
            break;


        default:
            isOpen = false;
    }

    // Calculate time until next change
    const targetTime = isOpen ? nextClose : nextOpen;
    let timeUntilChange = '';

    if (targetTime) {
        const diff = targetTime.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            timeUntilChange = `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            timeUntilChange = `${hours}h ${minutes}m`;
        } else {
            timeUntilChange = `${minutes}m`;
        }
    }

    return {
        isOpen,
        nextOpen,
        nextClose,
        timeUntilChange
    };
}
