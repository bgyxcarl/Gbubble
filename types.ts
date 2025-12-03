
export type TxType = 'native' | 'erc20';

export interface Transaction {
  id: string;
  hash: string;       // Displayed as "Transaction Hash"
  method: string;     // Displayed as "Method"
  block: number;      // Displayed as "Block"
  timestamp: string;  // Used to calculate "Age"
  from: string;
  to: string;
  value: number;      // Displayed as "Amount"
  token: string;      // Displayed as "Token" (Transfers only)
  fee?: number;       // Displayed as "Txn Fee" (Transactions only)
  type: TxType;
  status: 'success' | 'pending' | 'failed';
}

export interface AddressNode {
  id: string;
  balance: number;
  type: 'wallet' | 'contract' | 'exchange';
  activityScore: number;
  groupId?: number;
  groupSize?: number; // Added for cluster size styling
  groupColor?: string;
  groupColorIndex?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  hop?: number; // Added: Distance from base/target nodes (0 = base, 1 = direct neighbor, etc.)
}

export interface AnalysisResult {
  address: string;
  tags: string[];
  riskScore: number; // 0-100
  behaviorSummary: string;
  similarAddresses?: string[];
}

export enum Tab {
  DATA = 'DATA',
  VISUALIZE = 'VISUALIZE',
  ANALYSIS = 'ANALYSIS'
}

export interface GeminiAnalysisResponse {
  insights: AnalysisResult[];
  globalTrend: string;
}
