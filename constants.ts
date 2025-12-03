
import { Transaction } from './types';

const NAMED_ENTITIES = [
  'Binance 8', 'Gnosis Safe General', 'Starknet Bridge', 'Wintermute', 
  'Alameda (Legacy)', 'Kraken Hot Wallet', 'Uniswap V3: USDC', 'Optimism Gateway'
];

const METHODS = ['Transfer', 'Swap', 'Approve', 'Deposit', 'Withdraw', 'Execute', 'Mint'];

// Initial state is now empty for professional use (User starts with 0 data)
export const MOCK_DATA: Transaction[] = [];
