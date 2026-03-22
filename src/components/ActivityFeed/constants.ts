export const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'] as const;
export type AgentId = typeof AGENT_ORDER[number];
