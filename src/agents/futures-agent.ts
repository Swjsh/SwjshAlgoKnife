/**
 * futures-agent.ts - ES/NQ Futures Trading Agent "Pivot Pete"
 * Strategy: Multi-timeframe pivot rejection
 * Market: CME ES (E-mini S&P 500), NQ (E-mini Nasdaq)
 */

import { writeFileSync } from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { PivotStrategy } from '../lib/engine/strategies/pivot';
import { Candle, StrategyConfig } from '../lib/engine/types';
import { AlpacaDataProvider, AlpacaConfig } from '../lib/data-providers/alpaca';
import { PaperTradingEngine, PaperTradeConfig } from '../lib/engine/paper-trading';
import { mulberry32, hashStringToSeed } from '../lib/utils/prng';

// Load environment variables
dotenvConfig({ path: path.resolve(__dirname, '../../.env.local') });

interface FuturesConfig {
  symbol: 'ES' | 'NQ' | 'YM';
  mode: 'paper-sim' | 'live';
  strategy: 'pivot';
}

interface FuturesSignal {
  timestamp: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'FLAT';
  price: number;
  strategy: string;
  notes?: string;
}

interface FuturesStatus {
  agent: string;
  mode: string;
  symbol: string;
  generated_at: string;
  latest_price: number;
  signal_count: number;
  latest_signal?: FuturesSignal;
  heartbeat: string;
  pivots?: {
    daily: any;
    weekly: any;
    monthly: any;
  };
  performance?: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  account?: {
    balance: number;
    equity: number;
    openPositions: number;
    dailyPnL: number;
  };
  error?: string;
}

class FuturesAgent {
  private config: FuturesConfig;
  private signals: FuturesSignal[] = [];
  private strategy: PivotStrategy;
  private alpacaProvider: AlpacaDataProvider;
  private paperTrading: PaperTradingEngine;

  constructor(config: FuturesConfig) {
    this.config = config;
    
    // Initialize pivot strategy
    const strategyConfig: StrategyConfig = {
      id: 'pivot_rejection',
      name: 'Multi-Timeframe Pivot Rejection',
      isActive: true,
      params: {},
      category: 'FUTURES'
    };
    
    this.strategy = new PivotStrategy(strategyConfig);

    // Initialize Alpaca data provider
    const alpacaConfig: AlpacaConfig = {
      apiKey: process.env.APCA_API_KEY_ID || '',
      secretKey: process.env.APCA_API_SECRET_KEY || '',
      baseUrl: process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets',
      feed: 'sip'
    };
    this.alpacaProvider = new AlpacaDataProvider(alpacaConfig);

    // Initialize paper trading engine
    const tradingConfig: PaperTradeConfig = {
      accountBalance: 100000,
      slippage: {
        futures: 0.5, // 0.5 ticks
        options: 0.10,
        fx: 1,
        equity: 0.01
      },
      positionSize: {
        futures: 1, // 1 contract per signal
        options: 1,
        fx: 10000,
        equity: 100
      }
    };
    this.paperTrading = new PaperTradingEngine(tradingConfig);
  }

  /**
   * Fetch current market price from Alpaca
   */
  private async fetchMarketPrice(): Promise<number> {
    try {
      return await this.alpacaProvider.getLatestQuote(this.config.symbol);
    } catch (error) {
      console.warn(`⚠️ Failed to fetch live price for ${this.config.symbol}, using fallback`);
      // Fallback to approximate prices
      return this.config.symbol === 'ES' ? 5000 : 
             this.config.symbol === 'NQ' ? 17750 : 6500;
    }
  }

  /**
   * Fetch real historical candles from Alpaca
   * 90 days of 5-minute data for backtesting
   */
  private async fetchHistoricalCandles(): Promise<Candle[]> {
    try {
      console.log(`📊 Fetching real ${this.config.symbol} data from Alpaca...`);
      
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      const candles = await this.alpacaProvider.getHistoricalBars(
        this.config.symbol,
        '5Min',
        start.toISOString(),
        end.toISOString(),
        5000 // Limit to avoid timeouts
      );

      if (candles.length === 0) {
        console.warn(`⚠️ No real data available for ${this.config.symbol}, falling back to synthetic`);
        return this.generateSyntheticFallback();
      }

      console.log(`✅ Retrieved ${candles.length} real ${this.config.symbol} candles`);
      return candles;

    } catch (error) {
      console.error(`❌ Error fetching real data for ${this.config.symbol}:`, error);
      console.log(`🔄 Falling back to synthetic data for testing`);
      return this.generateSyntheticFallback();
    }
  }

  /**
   * Synthetic fallback for when real data is unavailable
   */
  private async generateSyntheticFallback(): Promise<Candle[]> {
    console.log(`🧪 Generating synthetic ${this.config.symbol} data for testing...`);
    
    const candles: Candle[] = [];
    const now = new Date();
    
    const basePrice = this.config.symbol === 'ES' ? 5000 : 
                     this.config.symbol === 'NQ' ? 17750 : 6500;
    const rng = mulberry32(hashStringToSeed(`pivot-pete:${this.config.symbol}:synthetic-v1`));
    let price = basePrice + (rng() - 0.5) * 100;
    
    // Generate 30 days of historical data (5-min candles, trading hours only)
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    
    for (let day = 0; day < 30; day++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(currentDay.getDate() + day);
      
      // Skip weekends
      if (currentDay.getDay() === 0 || currentDay.getDay() === 6) continue;
      
      // Generate trading hours: 9:30 AM - 4:00 PM (78 5-min candles)
      const sessionStart = new Date(currentDay);
      sessionStart.setHours(9, 30, 0, 0);
      
      for (let i = 0; i < 78; i++) {
        const ts = new Date(sessionStart.getTime() + i * 5 * 60 * 1000);
        
        const drift = (rng() - 0.5) * 10;
        const open = price;
        const close = Math.max(1, open + drift);
        const high = Math.max(open, close) + rng() * 5;
        const low = Math.min(open, close) - rng() * 5;
        const volume = 500 + Math.round(rng() * 400);

        candles.push({
          timestamp: ts.toISOString(),
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume
        });

        price = close;
      }
      
      // Add overnight gap
      price += (rng() - 0.5) * 20;
    }

    return candles;
  }

  async run(): Promise<void> {
    console.log(`🏛️  Starting Pivot Pete (${this.config.symbol})`);
    console.log(`   Mode: ${this.config.mode} | Strategy: Pivot Rejection`);
    console.log(`   Data Source: Alpaca Markets (Real ${this.config.symbol} futures)`);

    try {
      // Test Alpaca connection first
      const connectionOk = await this.alpacaProvider.testConnection();
      if (!connectionOk) {
        throw new Error('Alpaca connection failed');
      }

      // Fetch real historical data
      const candles = await this.fetchHistoricalCandles();
      console.log(`📊 Processing ${candles.length} candles (${candles.length > 1000 ? 'REAL DATA' : 'synthetic fallback'})...`);

      // Run strategy on each candle
      let signalCount = 0;
      let latestSignal: FuturesSignal | undefined;
      let totalPnL = 0;

      for (const candle of candles) {
        const signal = this.strategy.onCandle(candle);
        
        if (signal) {
          signalCount++;
          latestSignal = {
            timestamp: signal.timestamp,
            symbol: this.config.symbol,
            action: signal.action as 'BUY' | 'SELL',
            price: signal.price,
            strategy: signal.strategy,
            notes: signal.notes
          };
          
          this.signals.push(latestSignal);
          
          // Execute trade through paper trading engine
          if (signal.action === 'BUY' || signal.action === 'SELL') {
            try {
              const fill = await this.paperTrading.executeSignal(signal, 'FUTURES');
              console.log(`💰 Paper Trade Executed: ${fill.side} ${fill.quantity} ${fill.symbol} @ ${fill.fillPrice.toFixed(2)}`);
              console.log(`   Slippage: $${(fill.slippage * 50).toFixed(2)} | Commission: $${fill.commission.toFixed(2)}`);
            } catch (error) {
              console.error(`❌ Paper trade execution failed:`, error);
            }
          }
          
          console.log(`🎯 SIGNAL #${signalCount}: ${signal.action} ${this.config.symbol} @ ${signal.price.toFixed(2)} - ${signal.notes}`);
        }

        // Update position prices for P&L tracking
        if (candles.indexOf(candle) % 100 === 0) { // Update every 100 candles for performance
          await this.paperTrading.updatePositions({ [this.config.symbol]: candle.close });
        }
      }

      // Get final P&L metrics
      const account = this.paperTrading.getAccount();
      const performance = this.paperTrading.getPerformanceMetrics();
      
      const currentPrice = candles[candles.length - 1]?.close || await this.fetchMarketPrice();

      // Extract pivot levels from strategy for status display
      const pivotData = (this.strategy as any).pivots;

      this.updateStatus({
        agent: 'futures',
        mode: this.config.mode,
        symbol: this.config.symbol,
        generated_at: new Date().toISOString(),
        latest_price: currentPrice,
        signal_count: signalCount,
        latest_signal: latestSignal,
        heartbeat: signalCount > 0 
          ? `Pivot Pete active - ${signalCount} signal(s) | P&L: $${account.totalPnL.toFixed(2)} | Win Rate: ${(performance.winRate * 100).toFixed(1)}%` 
          : 'Pivot Pete scanning - no signals this session',
        pivots: {
          daily: pivotData.daily,
          weekly: pivotData.weekly,
          monthly: pivotData.monthly
        },
        performance: {
          totalTrades: performance.totalTrades,
          winRate: performance.winRate,
          totalPnL: performance.totalPnL,
          sharpeRatio: performance.sharpeRatio,
          maxDrawdown: performance.maxDrawdown
        },
        account: {
          balance: account.balance,
          equity: account.equity,
          openPositions: account.positions.length,
          dailyPnL: account.dailyPnL
        }
      });

      console.log(`✅ Pivot Pete backtest complete: ${signalCount} signals found`);
      console.log(`   Latest ${this.config.symbol} price: ${currentPrice.toFixed(2)}`);
      console.log(`   📈 Performance Summary:`);
      console.log(`      Total Trades: ${performance.totalTrades}`);
      console.log(`      Win Rate: ${(performance.winRate * 100).toFixed(1)}%`);
      console.log(`      Total P&L: $${performance.totalPnL.toFixed(2)}`);
      console.log(`      Expectancy: $${performance.expectancy.toFixed(2)} per trade`);
      console.log(`      Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}`);
      console.log(`      Max Drawdown: ${(performance.maxDrawdown * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('❌ Pivot Pete execution error:', error);
      
      // Update status with error
      this.updateStatus({
        agent: 'futures',
        mode: this.config.mode,
        symbol: this.config.symbol,
        generated_at: new Date().toISOString(),
        latest_price: 0,
        signal_count: 0,
        heartbeat: `❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  private updateStatus(status: FuturesStatus): void {
    const statusPath = path.join(__dirname, '../../data/futures_agent_status.json');
    writeFileSync(statusPath, JSON.stringify(status, null, 2));
    console.log(`📝 Status updated: ${statusPath}`);
  }
}

// Default configuration
const config: FuturesConfig = {
  symbol: 'ES',
  mode: 'paper-sim',
  strategy: 'pivot'
};

// Run agent if called directly
if (require.main === module) {
  const agent = new FuturesAgent(config);
  agent.run()
    .then(() => {
      console.log('[Pivot Pete] Session complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Pivot Pete] Fatal error:', err);
      process.exit(1);
    });
}

export { FuturesAgent, FuturesConfig, FuturesSignal, FuturesStatus };
