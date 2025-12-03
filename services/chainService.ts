

import { Transaction, TxType } from '../types';

const API_KEY = 'PX2PXQZNZRB1QF52XKT9PZY4ZPVRUTG5YA';
const BASE_URL = 'https://api.etherscan.io/v2/api';

// Using a Rotating Key strategy or standard key for Tron
const TRON_API_KEY = '7b72de95-4dbf-41ad-b626-8361550705a8';
const TRON_HOST = 'https://apilist.tronscanapi.com/api';
const CORS_PROXY = 'https://corsproxy.io/?';

export interface ChainConfig {
    name: string;
    id: string;
    currency: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
    { name: 'Ethereum Mainnet', id: '1', currency: 'ETH' },
    { name: 'Tron Mainnet', id: 'TRON', currency: 'TRX' },
    { name: 'Sepolia Testnet', id: '11155111', currency: 'ETH' },
    { name: 'Holesky Testnet', id: '17000', currency: 'ETH' },
    { name: 'Arbitrum One', id: '42161', currency: 'ETH' },
    { name: 'Arbitrum Nova', id: '42170', currency: 'ETH' },
    { name: 'Arbitrum Sepolia', id: '421614', currency: 'ETH' },
    { name: 'Polygon Mainnet', id: '137', currency: 'POL' },
    { name: 'Polygon Amoy', id: '80002', currency: 'POL' },
    { name: 'Optimism', id: '10', currency: 'ETH' },
    { name: 'Optimism Sepolia', id: '11155420', currency: 'ETH' },
    { name: 'Base Mainnet', id: '8453', currency: 'ETH' },
    { name: 'Base Sepolia', id: '84532', currency: 'ETH' },
    { name: 'BSC Mainnet', id: '56', currency: 'BNB' }, 
    { name: 'Blast Mainnet', id: '81457', currency: 'ETH' },
    { name: 'Blast Sepolia', id: '168587773', currency: 'ETH' },
    { name: 'Linea Mainnet', id: '59144', currency: 'ETH' },
    { name: 'Linea Sepolia', id: '59141', currency: 'ETH' },
    { name: 'Scroll Mainnet', id: '534352', currency: 'ETH' },
    { name: 'Scroll Sepolia', id: '534351', currency: 'ETH' },
    { name: 'zkSync Mainnet', id: '324', currency: 'ETH' },
    { name: 'zkSync Sepolia', id: '300', currency: 'ETH' },
    { name: 'Gnosis Chain', id: '100', currency: 'XDAI' },
    { name: 'Celo Mainnet', id: '42220', currency: 'CELO' },
    { name: 'Celo Sepolia', id: '11142220', currency: 'CELO' },
    { name: 'Moonbeam', id: '1284', currency: 'GLMR' },
    { name: 'Moonriver', id: '1285', currency: 'MOVR' },
    { name: 'Moonbase Alpha', id: '1287', currency: 'DEV' },
    { name: 'Mantle Mainnet', id: '5000', currency: 'MNT' },
    { name: 'Mantle Sepolia', id: '5003', currency: 'MNT' },
    { name: 'opBNB Mainnet', id: '204', currency: 'BNB' },
    { name: 'opBNB Testnet', id: '5611', currency: 'BNB' },
    { name: 'BitTorrent Mainnet', id: '199', currency: 'BTT' },
    { name: 'Berachain Mainnet', id: '80094', currency: 'BERA' },
    { name: 'Taiko Mainnet', id: '167000', currency: 'ETH' },
    { name: 'Sei Mainnet', id: '1329', currency: 'SEI' },
    { name: 'Sonic Mainnet', id: '146', currency: 'S' },
    { name: 'Unichain Mainnet', id: '130', currency: 'ETH' },
    { name: 'World Mainnet', id: '480', currency: 'ETH' },
];

// Helper: Sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Generalized Tron Fetcher with Retry Logic for 429s
const fetchTronData = async (endpoint: string, params: Record<string, string>, retries = 3) => {
    // Set higher default limit if not overridden
    const limit = params.limit || '100';
    const urlParams = new URLSearchParams({ limit, ...params }); 
    const targetUrl = `${TRON_HOST}/${endpoint}?${urlParams.toString()}`;
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(proxyUrl, { 
                headers: { 'TRON-PRO-API-KEY': TRON_API_KEY } 
            });
            
            if (response.status === 429) {
                const waitTime = (i + 1) * 1000;
                console.warn(`Tron API Rate Limit (429) on ${endpoint}. Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }

            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.warn(`Tron Fetch Attempt ${i+1} Failed for ${endpoint}`, e);
            if (i === retries - 1) return null;
            await sleep(1000);
        }
    }
    return null;
};

const getTronStatus = (confirmed: boolean, contractRet?: string) => {
    if (!confirmed) return 'pending';
    if (contractRet === 'REVERT') return 'failed';
    return 'success';
};

// Map Tron Contract Types for Native Transactions
const mapTronContractType = (type: number): string => {
    switch (type) {
        case 1: return 'Transfer [TRX]';
        case 2: return 'Transfer [Asset]';
        case 4: return 'Vote';
        case 11: return 'Freeze Balance';
        case 12: return 'Unfreeze Balance';
        case 31: return 'Trigger Smart Contract';
        default: return `Contract Type ${type}`;
    }
};

const fetchTronHistory = async (address: string, dateRange?: { start: Date, end: Date }): Promise<Transaction[]> => {
    try {
        const transactions: Transaction[] = [];
        const seenIds = new Set<string>();
        const seenHashes = new Set<string>(); 

        // Execute all requests with allSettled to prevent one failure from blocking others
        // Increase limit to 100 to ensure we catch more tokens if they exist
        const results = await Promise.allSettled([
            fetchTronData('asset/transfer', { relatedAddress: address, start: '0', limit: '100' }), // TRX & TRC10
            fetchTronData('token_trc20/transfers', { relatedAddress: address, start: '0', limit: '100' }), // TRC20
            fetchTronData('trc721/transfers', { relatedAddress: address, start: '0', limit: '100' }), // TRC721
            fetchTronData('trc1155/transfers', { relatedAddress: address, start: '0', limit: '100' }), // TRC1155
            fetchTronData('internal-transaction', { address: address, start: '0', limit: '100' }), // Internal
            fetchTronData('transaction', { address: address, start: '0', count: 'true', limit: '100' }) // Generic/Native
        ]);

        const [assetRes, trc20Res, trc721Res, trc1155Res, internalRes, generalRes] = results;

        // --- PROCESS 1: TRX & TRC10 (asset/transfer) ---
        if (assetRes.status === 'fulfilled' && assetRes.value) {
            const assets = assetRes.value.Data || assetRes.value.data || [];
            if (Array.isArray(assets)) {
                assets.forEach((tx: any) => {
                    const txDate = new Date(tx.timestamp);
                    if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;
                    
                    const isTRC10 = tx.tokenInfo && tx.tokenInfo.tokenType === 'trc10';
                    const sourceType = isTRC10 ? 'TRC10' : 'TRX';
                    
                    let decimals = 6;
                    if (isTRC10 && tx.tokenInfo && tx.tokenInfo.tokenDecimal !== undefined) {
                        decimals = tx.tokenInfo.tokenDecimal;
                    }

                    const value = parseFloat(tx.amount) / Math.pow(10, decimals);
                    const symbol = tx.tokenInfo ? tx.tokenInfo.tokenAbbr : 'TRX';
                    
                    const uniqueId = `trx_asset_${tx.transactionHash}_${tx.blockId}`;

                    if(!seenIds.has(uniqueId)) {
                        seenIds.add(uniqueId);
                        transactions.push({
                            id: uniqueId,
                            hash: tx.transactionHash,
                            from: tx.transferFromAddress,
                            to: tx.transferToAddress,
                            value: value,
                            token: symbol,
                            timestamp: txDate.toISOString(),
                            status: getTronStatus(tx.confirmed, tx.contractRet),
                            method: `Transfer [${sourceType}]`, // STRICT TAGGING
                            block: tx.blockId,
                            fee: 0,
                            type: !isTRC10 ? 'native' : 'erc20'
                        });
                        if (!isTRC10) seenHashes.add(tx.transactionHash);
                    }
                });
            }
        }

        // --- PROCESS 2: TRC20 ---
        if (trc20Res.status === 'fulfilled' && trc20Res.value) {
            const trc20s = trc20Res.value.token_transfers || [];
            trc20s.forEach((tx: any) => {
                const txDate = new Date(tx.block_ts); // block_ts is usually ms
                if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;

                const uniqueId = `trc20_${tx.transaction_id}_${tx.from_address}_${tx.to_address}`;
                const decimals = tx.tokenInfo ? (tx.tokenInfo.tokenDecimal || 18) : 18;
                const value = parseFloat(tx.quant) / Math.pow(10, decimals);
                const symbol = tx.tokenInfo ? tx.tokenInfo.tokenAbbr : 'TRC20';

                if(!seenIds.has(uniqueId)) {
                    seenIds.add(uniqueId);
                    transactions.push({
                        id: uniqueId,
                        hash: tx.transaction_id,
                        from: tx.from_address,
                        to: tx.to_address,
                        value: value,
                        token: symbol,
                        timestamp: txDate.toISOString(),
                        status: getTronStatus(tx.confirmed, tx.contractRet),
                        method: `Transfer [TRC20]`, // STRICT TAGGING
                        block: tx.block,
                        fee: 0,
                        type: 'erc20'
                    });
                }
            });
        }

        // --- PROCESS 3: TRC721 ---
        if (trc721Res.status === 'fulfilled' && trc721Res.value) {
            const trc721s = trc721Res.value.token_transfers || [];
            trc721s.forEach((tx: any) => {
                const txDate = new Date(tx.block_ts);
                if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;

                const uniqueId = `trc721_${tx.transaction_id}_${tx.token_id}`;
                const symbol = tx.tokenInfo ? tx.tokenInfo.tokenAbbr : 'NFT';
                const tokenLabel = `${symbol} #${tx.token_id}`;

                if(!seenIds.has(uniqueId)) {
                    seenIds.add(uniqueId);
                    transactions.push({
                        id: uniqueId,
                        hash: tx.transaction_id,
                        from: tx.from_address,
                        to: tx.to_address,
                        value: 1,
                        token: tokenLabel,
                        timestamp: txDate.toISOString(),
                        status: getTronStatus(tx.confirmed, tx.contractRet),
                        method: `Transfer [TRC721]`, // STRICT TAGGING
                        block: tx.block,
                        fee: 0,
                        type: 'erc20'
                    });
                }
            });
        }

        // --- PROCESS 4: TRC1155 ---
        if (trc1155Res.status === 'fulfilled' && trc1155Res.value) {
            const trc1155s = trc1155Res.value.token_transfers || [];
            trc1155s.forEach((tx: any) => {
                const txDate = new Date(tx.block_ts);
                if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;

                const uniqueId = `trc1155_${tx.transaction_id}_${tx.token_id}`;
                const symbol = tx.tokenInfo ? tx.tokenInfo.tokenAbbr : 'MT';
                const tokenLabel = `${symbol} #${tx.token_id}`;
                const value = parseFloat(tx.quant || '1');

                if(!seenIds.has(uniqueId)) {
                    seenIds.add(uniqueId);
                    transactions.push({
                        id: uniqueId,
                        hash: tx.transaction_id,
                        from: tx.from_address,
                        to: tx.to_address,
                        value: value, 
                        token: tokenLabel,
                        timestamp: txDate.toISOString(),
                        status: getTronStatus(tx.confirmed, tx.contractRet),
                        method: `Transfer [TRC1155]`, // STRICT TAGGING
                        block: tx.block,
                        fee: 0,
                        type: 'erc20'
                    });
                }
            });
        }

        // --- PROCESS 5: INTERNAL TRANSACTIONS ---
        if (internalRes.status === 'fulfilled' && internalRes.value) {
             const internals = internalRes.value.data || [];
             internals.forEach((tx: any) => {
                 const txDate = new Date(tx.timestamp);
                 if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;
                 
                 const uniqueId = `internal_${tx.hash}_${tx.from}_${tx.to}_${tx.value}`;
                 const value = parseFloat(tx.value) / 1000000;
                 
                 if (!seenIds.has(uniqueId)) {
                     seenIds.add(uniqueId);
                     transactions.push({
                         id: uniqueId,
                         hash: tx.hash,
                         from: tx.from,
                         to: tx.to,
                         value: value,
                         token: 'TRX',
                         timestamp: txDate.toISOString(),
                         status: !tx.rejected ? 'success' : 'failed',
                         method: 'Transfer [Internal]',
                         block: 0,
                         fee: 0,
                         type: 'native'
                     });
                 }
             });
        }

        // --- PROCESS 6: GENERIC TRANSACTIONS (Execution Layer) ---
        if (generalRes.status === 'fulfilled' && generalRes.value) {
            const generics = generalRes.value.data || generalRes.value.Data || [];
            generics.forEach((tx: any) => {
                const txDate = new Date(tx.timestamp);
                if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return;
                
                if (seenHashes.has(tx.hash)) return;

                const uniqueId = `gen_${tx.hash}`;
                let value = 0;
                let token = 'TRX';
                
                if (tx.contractData && tx.contractData.amount) {
                    value = parseFloat(tx.contractData.amount) / 1000000;
                }

                if (!seenIds.has(uniqueId)) {
                    seenIds.add(uniqueId);
                    transactions.push({
                        id: uniqueId,
                        hash: tx.hash,
                        from: tx.ownerAddress,
                        to: tx.toAddress || tx.contractData?.contract_address || 'Contract',
                        value: value,
                        token: token,
                        timestamp: txDate.toISOString(),
                        status: tx.result === 'SUCCESS' ? 'success' : 'failed',
                        method: mapTronContractType(tx.contractType), // Calls the mapper
                        block: tx.block,
                        fee: tx.cost ? (tx.cost.net_fee + tx.cost.energy_fee) / 1000000 : 0,
                        type: 'native'
                    });
                }
            });
        }

        return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
        console.error("TronScan API Critical Failure:", error);
        return [];
    }
}

export const fetchAddressHistory = async (address: string, chainId: string = '1', dateRange?: { start: Date, end: Date }): Promise<{ data: Transaction[], error?: string }> => {
    try {
        if (chainId === 'TRON') {
            if (!address.startsWith('T') || address.length !== 34) {
                return { data: [], error: 'Invalid Tron Address (must start with T)' };
            }
            const data = await fetchTronHistory(address, dateRange);
            return { data };
        }

        if (!address.startsWith('0x') || address.length !== 42) {
            return { data: [], error: 'Invalid Ethereum/EVM Address' };
        }

        const chainConfig = SUPPORTED_CHAINS.find(c => c.id === chainId) || SUPPORTED_CHAINS[0];
        const currency = chainConfig.currency;

        const buildUrl = (action: 'txlist' | 'tokentx' | 'txlistinternal') => {
            const params = new URLSearchParams({
                chainid: chainId,
                module: 'account',
                action: action,
                address: address,
                page: '1',
                offset: '1000',
                sort: 'desc',
                apikey: API_KEY
            });
            // Ensure startblock and endblock are present for better compatibility with Etherscan-like APIs
            params.append('startblock', '0');
            params.append('endblock', '99999999');
            return `${BASE_URL}?${params.toString()}`;
        };

        // Use allSettled for EVM too to prevent token failures from killing native data
        const results = await Promise.allSettled([
            fetch(buildUrl('txlist')),
            fetch(buildUrl('tokentx'))
        ]);

        const txRes = results[0].status === 'fulfilled' ? await results[0].value.json() : { status: '0', result: [] };
        const tokenRes = results[1].status === 'fulfilled' ? await results[1].value.json() : { status: '0', result: [] };

        let transactions: Transaction[] = [];

        if (txRes.status === '1' && Array.isArray(txRes.result)) {
            const natives = txRes.result
                .map((tx: any) => {
                    const txDate = new Date(parseInt(tx.timeStamp) * 1000);
                    if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return null;

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to || 'Contract Creation',
                        value: parseFloat(tx.value) / 1e18,
                        token: currency.toUpperCase(),
                        timestamp: txDate.toISOString(),
                        status: tx.isError === '0' ? 'success' : 'failed',
                        method: tx.functionName?.split('(')[0] || (tx.input && tx.input !== '0x' ? 'Contract' : 'Transfer'),
                        block: parseInt(tx.blockNumber),
                        fee: (parseInt(tx.gasUsed) * parseInt(tx.gasPrice)) / 1e18,
                        type: 'native' as TxType
                    };
                })
                .filter((tx: any) => tx !== null);
            transactions = [...transactions, ...natives];
        }

        if (tokenRes.status === '1' && Array.isArray(tokenRes.result)) {
            const tokens = tokenRes.result
                .map((tx: any) => {
                    const txDate = new Date(parseInt(tx.timeStamp) * 1000);
                    if (dateRange && (txDate < dateRange.start || txDate > dateRange.end)) return null;
                    
                    const tokenSym = (tx.tokenSymbol || 'TOKEN').toUpperCase();

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        value: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || '18')),
                        token: tokenSym,
                        timestamp: txDate.toISOString(),
                        status: 'success',
                        method: 'Transfer [ERC20]', // Standardize
                        block: parseInt(tx.blockNumber),
                        type: 'erc20' as TxType
                    };
                })
                .filter((tx: any) => tx !== null);
            transactions = [...transactions, ...tokens];
        }

        return { 
            data: transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) 
        };

    } catch (error) {
        console.error("API Error:", error);
        return { data: [], error: 'Failed to connect to Blockchain Explorer' };
    }
};
