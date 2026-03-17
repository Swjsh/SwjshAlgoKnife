// Intel module exports
export { default as intelBus } from './bus';
export type {
    IntelSignal,
    IntelScore,
    IntelSource,
    IntelDirection,
    ServiceHeartbeat,
} from './types';
export { INTEL_TTL_MS, INTEL_WEIGHTS } from './types';

// Sub-module exports
export { OrderFlowService } from './orderflow/service';
export { SentimentBridge } from './sentiment/bridge';
export { OnChainBridge } from './onchain/bridge';
export { WhaleFlowService } from './whale/service';

// Free feeds
export { startFreeFeeds, stopFreeFeeds, getFreeFeedStatus } from './free/service';

// Intel Adapter (bridge between intel bus and strategy engine)
export { IntelAdapter } from './adapter';
export type { IntelContext, StrategyAdaptations, MarketRegime } from './adapter';
