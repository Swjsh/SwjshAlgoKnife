"use client";

import React, { useState } from 'react';
import styles from './OrderPanel.module.css';

interface OrderPanelProps {
    symbol?: string;
    currentPrice?: number;
}

export default function OrderPanel({ symbol = 'BTC/USD', currentPrice = 97417.05 }: OrderPanelProps) {
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
    const [units, setUnits] = useState('1');
    const [limitPrice, setLimitPrice] = useState('');
    const [takeProfit, setTakeProfit] = useState(false);
    const [takeProfitPrice, setTakeProfitPrice] = useState('');
    const [stopLoss, setStopLoss] = useState(false);
    const [stopLossPrice, setStopLossPrice] = useState('');

    const spread = 0.05;
    const bidPrice = currentPrice - spread;
    const askPrice = currentPrice + spread;

    const handleSubmit = async () => {
        const payload = {
            symbol: symbol,
            action: side.toUpperCase(),
            price: orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice,
            strategy: `Manual ${orderType.charAt(0).toUpperCase() + orderType.slice(1)}`,
            notes: `Size: ${units}, TP: ${takeProfit ? takeProfitPrice : 'None'}, SL: ${stopLoss ? stopLossPrice : 'None'}`
        };
        console.log('Submitting Order:', payload);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.symbol}>{symbol}</span>
                <span className={styles.price}>${currentPrice.toLocaleString()}</span>
            </div>

            {/* Buy/Sell Toggle */}
            <div className={styles.sideToggle}>
                <button
                    className={`${styles.sideBtn} ${side === 'sell' ? styles.sellActive : ''}`}
                    onClick={() => setSide('sell')}
                >
                    SHORT<br /><span className={styles.priceSmall}>${bidPrice.toLocaleString()}</span>
                </button>
                <button
                    className={`${styles.sideBtn} ${side === 'buy' ? styles.buyActive : ''}`}
                    onClick={() => setSide('buy')}
                >
                    LONG<br /><span className={styles.priceSmall}>${askPrice.toLocaleString()}</span>
                </button>
            </div>

            {/* Order Type */}
            <div className={styles.orderTypes}>
                {(['market', 'limit', 'stop'] as const).map((type) => (
                    <button
                        key={type}
                        className={`${styles.typeBtn} ${orderType === type ? styles.typeActive : ''}`}
                        onClick={() => setOrderType(type)}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Units Input - Massive */}
            <div className={styles.inputGroup}>
                <label>SIZE (UNITS)</label>
                <input
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className={styles.input}
                    placeholder="0"
                />
            </div>

            {/* Limit Price (if limit order) */}
            {orderType === 'limit' && (
                <div className={styles.inputGroup}>
                    <label>LIMIT PRICE</label>
                    <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className={styles.input}
                        placeholder={currentPrice.toString()}
                    />
                </div>
            )}

            {/* Take Profit */}
            <div className={styles.exitSection}>
                <div className={styles.toggleWrapper}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={takeProfit}
                            onChange={(e) => setTakeProfit(e.target.checked)}
                        />
                    </label>
                    <span>TAKE PROFIT</span>
                </div>
                {takeProfit && (
                    <input
                        type="number"
                        value={takeProfitPrice}
                        onChange={(e) => setTakeProfitPrice(e.target.value)}
                        className={styles.inputSmall}
                        placeholder="Price"
                    />
                )}
            </div>

            {/* Stop Loss */}
            <div className={styles.exitSection}>
                <div className={styles.toggleWrapper}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={stopLoss}
                            onChange={(e) => setStopLoss(e.target.checked)}
                        />
                    </label>
                    <span>STOP LOSS</span>
                </div>
                {stopLoss && (
                    <input
                        type="number"
                        value={stopLossPrice}
                        onChange={(e) => setStopLossPrice(e.target.value)}
                        className={styles.inputSmall}
                        placeholder="Price"
                    />
                )}
            </div>

            {/* Submit Button */}
            <button
                className={`${styles.submitBtn} ${side === 'buy' ? styles.buyBtn : styles.sellBtn}`}
                onClick={handleSubmit}
            >
                EXECUTE {side === 'buy' ? 'LONG' : 'SHORT'}
            </button>
        </div>
    );
}
