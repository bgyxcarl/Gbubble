import React, { useState, useRef, useMemo } from 'react';
import { Transaction, TxType } from '../types';
import { normalizeCsvData } from '../services/geminiService';
import { fetchAddressHistory, SUPPORTED_CHAINS } from '../services/chainService';
import { Edit2, Save, Plus, Trash2, Upload, FileJson, Table as TableIcon, Download, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Search, X, CheckCircle2, Network, Copy, CheckSquare, Square, ClipboardCheck, MoreHorizontal, CalendarClock, Target, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;
const MotionTr = motion.tr as any;

interface DataEditorProps {
  data: Transaction[];
  setData: React.Dispatch<React.SetStateAction<Transaction[]>>;
  activeType: TxType;
  setActiveType: (type: TxType) => void;
  theme: 'light' | 'dark';
  baseAddresses: Set<string>;
  setBaseAddresses: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSyncBackend: (newTxns: Transaction[]) => void;
}

type SortKey = keyof Transaction;
type SortDirection = 'asc' | 'desc';
type ImportTypeHint = 'native' | 'erc20' | 'mixed';

const getAge = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const parseCSVRow = (row: string): string[] => {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const DataEditor: React.FC<DataEditorProps> = ({ data, setData, activeType, setActiveType, theme, baseAddresses, setBaseAddresses, onSyncBackend }) => {
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('formatted');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRow, setTempRow] = useState<any | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Fetch Modal State
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchAddress, setFetchAddress] = useState<string>('');
  const [fetchChainId, setFetchChainId] = useState('1'); 
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');

  const [useDateFilter, setUseDateFilter] = useState(true);
  const [fetchStartDate, setFetchStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15); 
    return d.toISOString().split('T')[0];
  });
  const [fetchEndDate, setFetchEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Import Modal State
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1); 
  const [importHint, setImportHint] = useState<ImportTypeHint>('native');
  const [csvBaseAddress, setCsvBaseAddress] = useState(''); 
  const [importResultMsg, setImportResultMsg] = useState<string>('');
  
  // Base Address Management State
  const [showBaseAddressManager, setShowBaseAddressManager] = useState(false);
  const [newBaseAddressInput, setNewBaseAddressInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'timestamp',
    direction: 'desc'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgMain = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
  const bgSub = theme === 'light' ? 'bg-gray-100' : 'bg-[#222]';
  const borderMain = theme === 'light' ? 'border-black' : 'border-gray-600';
  const textMain = theme === 'light' ? 'text-black' : 'text-gray-100';
  const inputBg = theme === 'light' ? 'bg-white' : 'bg-black text-white border-gray-700';

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedData = useMemo(() => {
    let filtered = data.filter(t => t.type === activeType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.hash && t.hash.toLowerCase().includes(q)) ||
        (t.from && t.from.toLowerCase().includes(q)) ||
        (t.to && t.to.toLowerCase().includes(q)) ||
        (t.token && t.token.toLowerCase().includes(q)) ||
        (t.method && t.method.toLowerCase().includes(q)) ||
        String(t.block).includes(q)
      );
    }

    if (!sortConfig.key) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      let comparison = 0;
      if (sortConfig.key === 'value' || sortConfig.key === 'block' || sortConfig.key === 'fee') {
        comparison = (aVal as number) - (bVal as number);
      } else if (sortConfig.key === 'timestamp') {
        // Convert to string safely before creating Date to avoid type overlap errors
        comparison = new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime();
      } else {
        const strA = aVal !== null && aVal !== undefined ? String(aVal) : '';
        const strB = bVal !== null && bVal !== undefined ? String(bVal) : '';
        comparison = strA.localeCompare(strB);
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, activeType, sortConfig, searchQuery]);

  const handleSelectAll = () => {
    if (selectedIds.size === sortedData.length && sortedData.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(sortedData.map(d => d.id)));
    }
  };

  const handleSelectRow = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleAddBaseAddress = () => {
      if(newBaseAddressInput.trim()) {
          const newSet = new Set(baseAddresses);
          newSet.add(newBaseAddressInput.trim().toLowerCase());
          setBaseAddresses(newSet);
          setNewBaseAddressInput('');
      }
  };

  const handleRemoveBaseAddress = (addr: string) => {
      const newSet = new Set(baseAddresses);
      newSet.delete(addr);
      setBaseAddresses(newSet);
  };

  const handleCopyToClipboard = () => {
      const targetData = selectedIds.size > 0 
          ? sortedData.filter(d => selectedIds.has(d.id))
          : sortedData;
      
      if (targetData.length === 0) return;

      const headers = ['Hash', 'Method', 'Block', 'Time', 'From', 'To', 'Value', activeType === 'native' ? 'Fee' : 'Token'];
      const rows = targetData.map(d => [
          d.hash, 
          d.method, 
          d.block, 
          d.timestamp, 
          d.from, 
          d.to, 
          d.value, 
          activeType === 'native' ? d.fee : d.token
      ].join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      
      navigator.clipboard.writeText(csvContent).then(() => {
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 2000);
      });
  };

  const handleStartEdit = (row: Transaction) => {
    setEditingId(row.id);
    setTempRow({ ...row });
  };

  const handleSave = () => {
    if (tempRow) {
      const finalRow: Transaction = {
          ...tempRow,
          value: typeof tempRow.value === 'string' ? parseFloat(tempRow.value) : tempRow.value,
          fee: tempRow.fee && typeof tempRow.fee === 'string' ? parseFloat(tempRow.fee) : tempRow.fee,
          block: typeof tempRow.block === 'string' ? parseInt(tempRow.block) : tempRow.block,
          token: tempRow.token ? tempRow.token.toUpperCase() : 'TOKEN'
      };
      
      if (isNaN(finalRow.value)) finalRow.value = 0;

      setData(prev => prev.map(row => row.id === finalRow.id ? finalRow : row));
      setEditingId(null);
      setTempRow(null);
      // NOTE: Edits are currently local only, implementing edit sync is complex for batch logic, so kept local for now.
    }
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setTempRow(null);
  };

  const handleChange = (field: keyof Transaction, value: any) => {
    if (tempRow) {
      setTempRow({ ...tempRow, [field]: value });
    }
  };

  const handleDelete = (id: string) => {
    setData(prev => prev.filter(row => row.id !== id));
    if (selectedIds.has(id)) {
        const newSet = new Set(selectedIds);
        newSet.delete(id);
        setSelectedIds(newSet);
    }
    // Delete is local for now.
  };

  const handleAddRow = () => {
    const newRow: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      hash: `0x${Math.random().toString(16).substr(2, 16)}...`,
      method: 'Transfer',
      block: 18000000,
      timestamp: new Date().toISOString(),
      from: '0x...',
      to: '0x...',
      value: 0,
      token: activeType === 'native' ? 'ETH' : 'USDC',
      fee: activeType === 'native' ? 0.001 : undefined,
      type: activeType,
      status: 'pending'
    };
    onSyncBackend([newRow]); // Sync new row immediately
    handleStartEdit(newRow);
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (csvBaseAddress.trim()) {
        const newSet = new Set(baseAddresses);
        const targets = csvBaseAddress.split(/[\n, ]+/).filter(t => t.trim().length > 0);
        targets.forEach(t => newSet.add(t.trim().toLowerCase()));
        setBaseAddresses(newSet);
    }

    setImportStep(2); 

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const snippet = lines.slice(0, 5).join('\n');
        
        try {
            const mapping = await normalizeCsvData(snippet, importHint);
            const startIdx = mapping.hasHeader ? 1 : 0;
            let addedNative = 0;
            let addedErc20 = 0;
            
            const newTxns: Transaction[] = lines.slice(startIdx).map(line => {
                const cols = parseCSVRow(line);
                if (cols.length < 2) return null;
                const getCol = (idx: number) => idx > -1 && cols[idx] ? cols[idx] : '';

                let valStr = getCol(mapping.valueIndex).replace(/,/g, ''); 
                const val = parseFloat(valStr);
                
                let tokenSymbol = getCol(mapping.tokenIndex);
                if (tokenSymbol) tokenSymbol = tokenSymbol.toUpperCase();
                
                let rowType: TxType = 'native';
                if (importHint === 'native') rowType = 'native';
                else if (importHint === 'erc20') rowType = 'erc20';
                else if (mapping.detectedType === 'mixed' || importHint === 'mixed') {
                    rowType = tokenSymbol && tokenSymbol.length > 0 ? 'erc20' : 'native';
                } else {
                    rowType = mapping.detectedType === 'erc20' ? 'erc20' : 'native';
                }

                if (rowType === 'native') addedNative++;
                else addedErc20++;

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    hash: getCol(mapping.hashIndex) || `0x${Math.random().toString(16).substr(2, 16)}...`,
                    method: getCol(mapping.methodIndex) || 'Transfer',
                    block: parseInt(getCol(mapping.blockIndex)) || 0,
                    timestamp: getCol(mapping.timestampIndex) || new Date().toISOString(),
                    from: getCol(mapping.fromIndex) || '0xUnknown',
                    to: getCol(mapping.toIndex) || '0xUnknown',
                    value: isNaN(val) ? 0 : val,
                    token: tokenSymbol || (rowType === 'native' ? 'ETH' : 'TOKEN'),
                    fee: rowType === 'native' ? (parseFloat(getCol(mapping.feeIndex)) || 0) : undefined,
                    type: rowType,
                    status: 'success'
                };
            }).filter(Boolean) as Transaction[];
            
            onSyncBackend(newTxns); // SYNC TO BACKEND
            
            setImportResultMsg(`Success! Saved to Database.\n\nAdded:\n• ${addedNative} to Transactions (Native)\n• ${addedErc20} to Transfers (ERC20)\n\nReason: ${mapping.confidenceReason || 'User Hint + AI Verification'}`);
            setImportStep(3);

        } catch (err: any) {
            console.error(err);
            setImportResultMsg("Analysis Failed. The file format was too ambiguous.");
            setImportStep(3);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  const handleFetch = async () => {
      if (!fetchAddress.trim()) return;
      
      setIsFetching(true);
      setFetchError('');
      
      const addresses = fetchAddress.split(/[\n, ]+/).map(a => a.trim()).filter(a => a.length > 0);

      if (addresses.length === 0) {
          setIsFetching(false);
          return;
      }
      
      const newBaseSet = new Set(baseAddresses);
      addresses.forEach(addr => newBaseSet.add(addr.toLowerCase()));
      setBaseAddresses(newBaseSet);
      
      try {
          let dateRange;
          if (useDateFilter) {
              const endObj = new Date(fetchEndDate);
              endObj.setHours(23, 59, 59, 999); 
              dateRange = {
                  start: new Date(fetchStartDate),
                  end: endObj
              };
          }

          let allFetchedTxns: Transaction[] = [];
          let failCount = 0;

          for (const addr of addresses) {
              const result = await fetchAddressHistory(addr, fetchChainId, dateRange);
              
              if (result.error) {
                  console.warn(`Fetch failed for ${addr}:`, result.error);
                  failCount++;
              } else {
                  allFetchedTxns = [...allFetchedTxns, ...result.data];
              }

              if (addresses.length > 1) {
                  await new Promise(r => setTimeout(r, 200));
              }
          }
          
          if (allFetchedTxns.length === 0 && failCount > 0) {
              setFetchError(`Failed to fetch data. ${failCount} addresses failed.`);
          } else {
              if (allFetchedTxns.length === 0) {
                  setFetchError("No transactions found for these addresses.");
              } else {
                  // Filter uniqueness on frontend before updating state/backend
                  // Ideally backend handles ignore duplicates, but frontend filter is good UX
                  const existingHashes = new Set(data.map(t => t.hash + t.type + t.value)); // simple unique key
                  const uniqueNewTxns = allFetchedTxns.filter(t => !existingHashes.has(t.hash + t.type + t.value));

                  if (uniqueNewTxns.length > 0) {
                      onSyncBackend(uniqueNewTxns); // SYNC TO BACKEND
                  } else {
                      console.log("No new unique transactions to sync.");
                  }

                  if (failCount > 0) {
                      console.warn(`${failCount} addresses failed to fetch.`);
                  }
                  
                  setShowFetchModal(false);
                  setFetchAddress('');
              }
          }
      } catch (e: any) {
          setFetchError('An unexpected error occurred during batch fetch.');
          console.error(e);
      } finally {
          setIsFetching(false);
      }
  };

  const truncate = (str: any, len = 14) => {
    const s = str ? String(str) : '';
    if (s.length < len) return s;
    return `${s.slice(0, 6)}...${s.slice(-6)}`;
  };

  const SortHeader = ({ label, field, className = "" }: { label: string, field: SortKey, className?: string }) => (
    <th 
        onClick={() => handleSort(field)}
        className={`p-4 font-mono text-xs uppercase tracking-wider border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} cursor-pointer hover:bg-gray-800 transition-colors select-none group whitespace-nowrap ${className}`}
    >
        <div className="flex items-center gap-2">
            {label}
            <span className="opacity-50 group-hover:opacity-100 transition-opacity">
                {sortConfig.key === field ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                ) : (
                    <ArrowUpDown size={12} />
                )}
            </span>
        </div>
    </th>
  );

  const editInputClass = `w-full ${inputBg} border-2 border-indigo-300 focus:border-blue-600 font-black p-2 text-sm shadow-inner outline-none transition-colors rounded-sm`;

  return (
    <div className={`${bgMain} p-6 rounded-none border-4 ${borderMain} neo-shadow h-full flex flex-col relative`}>
      
      <AnimatePresence>
        {showImportWizard && (
             <MotionDiv 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            >
                <MotionDiv 
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                    className={`w-full max-w-lg ${bgMain} border-4 ${borderMain} neo-shadow-lg p-8 relative ${textMain}`}
                >
                    <button onClick={() => { setShowImportWizard(false); setImportStep(1); setCsvBaseAddress(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24}/></button>
                    
                    {importStep === 1 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-blue-600 text-white p-2 border-2 border-black"><Upload size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Import Data Source</h2>
                            </div>
                            <p className="text-sm font-mono text-gray-500">Step 1: Help our AI understand your CSV content.</p>
                            
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-700">
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500 flex items-center gap-2">
                                  <Target size={12} /> Base/Seed Addresses (Optional)
                                </label>
                                <textarea 
                                    placeholder="Enter addresses to mark as '0' node (comma or newline separated)..." 
                                    value={csvBaseAddress}
                                    onChange={(e) => setCsvBaseAddress(e.target.value)}
                                    className={`w-full p-2 border border-gray-400 ${inputBg} text-sm font-mono h-24 resize-none`}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">These addresses will be highlighted with a red badge in visualizations.</p>
                            </div>

                            <div className="space-y-3">
                                <button onClick={() => setImportHint('native')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'native' ? 'border-blue-600 bg-blue-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                                    <span className="font-bold">Native Transactions (ETH/BTC)</span>
                                    {importHint === 'native' && <CheckCircle2 className="text-blue-600" />}
                                </button>
                                <button onClick={() => setImportHint('erc20')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'erc20' ? 'border-purple-600 bg-purple-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                                    <span className="font-bold">Token Transfers (ERC20)</span>
                                    {importHint === 'erc20' && <CheckCircle2 className="text-purple-600" />}
                                </button>
                                <button onClick={() => setImportHint('mixed')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'mixed' ? 'border-orange-500 bg-orange-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                                    <span className="font-bold">Mixed / Unsure</span>
                                    {importHint === 'mixed' && <CheckCircle2 className="text-orange-500" />}
                                </button>
                            </div>

                            <input type="file" ref={fileInputRef} onChange={handleCSVImport} className="hidden" accept=".csv" />
                            <button onClick={triggerFileUpload} className={`w-full py-3 font-black uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}>
                                Select CSV File
                            </button>
                        </div>
                    )}

                    {importStep === 2 && (
                        <div className="text-center py-12">
                             <Loader2 size={48} className="animate-spin mx-auto mb-4 text-blue-600" />
                             <h3 className="text-xl font-black uppercase mb-2">AI Analysis in Progress...</h3>
                             <p className="text-sm font-mono text-gray-500">Detecting columns and classifying rows...</p>
                        </div>
                    )}
                    {importStep === 3 && (
                         <div className="space-y-6">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="bg-green-500 text-white p-2 border-2 border-black"><CheckCircle2 size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Import Complete</h2>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 border-2 border-gray-300 dark:border-gray-700 font-mono text-sm whitespace-pre-line leading-relaxed">
                                {importResultMsg}
                            </div>
                            <button onClick={() => { setShowImportWizard(false); setImportStep(1); setCsvBaseAddress(''); }} className={`w-full py-3 font-black uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}>
                                Done
                            </button>
                         </div>
                    )}
                </MotionDiv>
            </MotionDiv>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex flex-wrap gap-2 items-center">
                <div className={`flex mr-2 border-2 ${borderMain} ${bgSub} p-1`}>
                    <button 
                        onClick={() => { setActiveType('native'); setSelectedIds(new Set()); }}
                        className={`px-4 py-1.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeType === 'native' 
                            ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black') 
                            : 'text-gray-500'}`}
                    >
                        Transactions
                    </button>
                    <button 
                        onClick={() => { setActiveType('erc20'); setSelectedIds(new Set()); }}
                        className={`px-4 py-1.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeType === 'erc20' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                    >
                        Token Transfers
                    </button>
                </div>

                <div className="relative flex items-center h-full group">
                    <div className="absolute left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <Search size={16} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`pl-9 pr-8 py-2 border-2 ${borderMain} font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200 w-32 md:w-64 transition-all ${inputBg}`}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="flex gap-1 relative">
                    <button 
                        onClick={() => setShowBaseAddressManager(!showBaseAddressManager)}
                        className={`p-2 border-2 ${borderMain} transition-all ${baseAddresses.size > 0 ? 'bg-red-50 text-red-600 border-red-200' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}
                        title="Manage Base/Target Addresses"
                    >
                        <Target size={18} />
                    </button>
                    
                    <button onClick={() => setViewMode('formatted')} className={`p-2 border-2 ${borderMain} transition-all ${viewMode === 'formatted' ? 'bg-yellow-400 text-black' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}><TableIcon size={18} /></button>
                    <button onClick={() => setViewMode('raw')} className={`p-2 border-2 ${borderMain} transition-all ${viewMode === 'raw' ? 'bg-pink-500 text-white' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}><FileJson size={18} /></button>

                    <AnimatePresence>
                    {showBaseAddressManager && (
                        <MotionDiv 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute top-12 left-0 z-50 w-72 ${bgMain} border-4 ${borderMain} neo-shadow p-4`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-black text-xs uppercase">Base Targets (Nodes)</h4>
                                <button onClick={() => setShowBaseAddressManager(false)}><X size={14}/></button>
                            </div>
                            <div className="flex gap-2 mb-3">
                                <input 
                                    value={newBaseAddressInput}
                                    onChange={(e) => setNewBaseAddressInput(e.target.value)}
                                    placeholder="Add address..."
                                    className={`flex-1 text-xs p-2 border-2 ${borderMain} ${inputBg}`}
                                />
                                <button onClick={handleAddBaseAddress} className="bg-blue-600 text-white p-2 border-2 border-black"><Plus size={14}/></button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {Array.from(baseAddresses).map(addr => (
                                    <div key={addr} className="flex justify-between items-center text-xs bg-gray-100 dark:bg-gray-800 p-2 border border-gray-300 dark:border-gray-700">
                                        <span className="truncate w-40 font-mono">{truncate(addr)}</span>
                                        <button onClick={() => handleRemoveBaseAddress(addr)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button>
                                    </div>
                                ))}
                                {baseAddresses.size === 0 && <p className="text-xs text-gray-400 italic">No base addresses set.</p>}
                            </div>
                        </MotionDiv>
                    )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setShowImportWizard(true)} className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform`}><Upload size={16} /> <span className="hidden lg:inline">Smart Import</span></button>
                <button onClick={() => setShowFetchModal(true)} className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform`}><Download size={16} /> Fetch Data</button>
                <button onClick={handleAddRow} className={`flex items-center gap-2 bg-blue-600 text-white px-4 py-2 font-bold border-2 ${borderMain} neo-shadow-hover transition-transform`}><Plus size={18} /> Add</button>
            </div>
        </div>

        <div className={`flex items-center justify-between ${bgSub} border-2 ${borderMain} p-2`}>
            <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
                    <MoreHorizontal size={14} />
                    <span>Total Records:</span>
                    <span className={`px-2 py-0.5 rounded ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'}`}>{sortedData.length}</span>
                </div>
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600">
                        <CheckSquare size={14} />
                        <span>Selected: {selectedIds.size}</span>
                    </div>
                )}
                {baseAddresses.size > 0 && (
                     <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500">
                        <Target size={14} />
                        <span>Targets: {baseAddresses.size}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={handleCopyToClipboard}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold border-2 ${borderMain} transition-all
                        ${copyFeedback ? 'bg-green-400 text-black' : `${bgMain} ${textMain} hover:bg-gray-200/20`}
                    `}
                >
                    {copyFeedback ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                    {copyFeedback ? 'Copied!' : selectedIds.size > 0 ? 'Copy Selected' : 'Copy All'}
                </button>
            </div>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden border-2 ${borderMain} ${theme === 'light' ? 'bg-gray-50' : 'bg-[#111]'} relative shadow-inner`}>
        {viewMode === 'formatted' ? (
          <div className="h-full overflow-auto custom-scrollbar">
              <table className={`w-full border-collapse text-left ${bgMain}`}>
                <thead className="sticky top-0 z-10 shadow-md">
                <tr>
                    <th className={`p-4 border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} w-10`}>
                         <div onClick={handleSelectAll} className="cursor-pointer hover:text-blue-400 transition-colors">
                             {selectedIds.size > 0 && selectedIds.size === sortedData.length ? <CheckSquare size={16} /> : <Square size={16} />}
                         </div>
                    </th>
                    <SortHeader label="Transaction Hash" field="hash" />
                    <SortHeader label="Method" field="method" />
                    <SortHeader label="Block" field="block" />
                    <SortHeader label="Age" field="timestamp" />
                    <SortHeader label="From" field="from" />
                    <SortHeader label="To" field="to" />
                    <SortHeader label="Amount" field="value" className="text-right" />
                    {activeType === 'native' ? (
                        <SortHeader label="Txn Fee" field="fee" className="text-right" />
                    ) : (
                        <SortHeader label="Token" field="token" />
                    )}
                    <th className={`p-4 font-mono text-xs uppercase tracking-wider border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} text-center`}>Action</th>
                </tr>
                </thead>
                <tbody className={`font-mono text-sm ${textMain}`}>
                <AnimatePresence mode="popLayout">
                    {sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="p-12 text-center text-gray-400 font-bold uppercase">
                                <div className="flex flex-col items-center gap-2">
                                    {searchQuery ? <Search size={48} className="opacity-20" /> : <TableIcon size={48} className="opacity-20" />}
                                    <span>{searchQuery ? `No matches for "${searchQuery}"` : `No Data Available`}</span>
                                    <div className="mt-4">
                                        <button onClick={() => setShowFetchModal(true)} className="text-blue-600 underline hover:text-blue-800">Fetch Chain Data</button>
                                        <span className="mx-2 text-gray-300">|</span>
                                        <button onClick={() => setShowImportWizard(true)} className="text-blue-600 underline hover:text-blue-800">Import CSV</button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((row) => (
                        <MotionTr
                            key={row.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className={`border-b ${theme === 'light' ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-900'} transition-all duration-200
                              ${editingId === row.id 
                                ? 'bg-yellow-50/10 ring-4 ring-inset ring-blue-600 z-20 relative shadow-2xl scale-[1.005]' 
                                : selectedIds.has(row.id) ? (theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20') : ''
                              }`}
                        >
                            <td className="p-4 w-10 text-center">
                                <div onClick={() => handleSelectRow(row.id)} className={`cursor-pointer ${selectedIds.has(row.id) ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}>
                                    {selectedIds.has(row.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                </div>
                            </td>

                            {editingId === row.id && tempRow ? (
                            <>
                                <td className="p-2 relative">
                                    <div className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 font-black uppercase tracking-wider z-30 shadow-sm">EDITING</div>
                                    <input type="text" value={tempRow.hash} onChange={(e) => handleChange('hash', e.target.value)} className={editInputClass} />
                                </td>
                                <td className="p-2"><input type="text" value={tempRow.method} onChange={(e) => handleChange('method', e.target.value)} className={editInputClass} /></td>
                                <td className="p-2"><input type="text" value={tempRow.block} onChange={(e) => handleChange('block', e.target.value)} className={editInputClass} /></td>
                                <td className="p-2 text-gray-400 text-xs italic font-bold">Auto-Calc</td>
                                <td className="p-2"><input type="text" value={tempRow.from} onChange={(e) => handleChange('from', e.target.value)} className={editInputClass} /></td>
                                <td className="p-2"><input type="text" value={tempRow.to} onChange={(e) => handleChange('to', e.target.value)} className={editInputClass} /></td>
                                <td className="p-2"><input type="text" value={tempRow.value} onChange={(e) => handleChange('value', e.target.value)} className={`${editInputClass} text-right`} /></td>
                                {activeType === 'native' ? (
                                    <td className="p-2"><input type="text" value={tempRow.fee} onChange={(e) => handleChange('fee', e.target.value)} className={`${editInputClass} text-right`} /></td>
                                ) : (
                                    <td className="p-2"><input type="text" value={tempRow.token} onChange={(e) => handleChange('token', e.target.value)} className={editInputClass} /></td>
                                )}
                                <td className="p-2 flex justify-center gap-2 items-center">
                                    <button onClick={handleSave} className="text-white bg-green-600 p-2.5 rounded-lg shadow-lg hover:bg-green-500 hover:scale-110 transition-all border-2 border-green-700" title="Save Changes"><Save size={18} /></button>
                                    <button onClick={handleCancelEdit} className="text-white bg-red-500 p-2.5 rounded-lg shadow-lg hover:bg-red-400 hover:scale-110 transition-all border-2 border-red-600" title="Cancel"><X size={18} /></button>
                                </td>
                            </>
                            ) : (
                            <>
                                <td className="p-4 text-blue-500 cursor-pointer hover:underline text-xs font-medium">{truncate(row.hash)}</td>
                                <td className="p-4"><span className={`${theme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-gray-800 text-gray-300 border-gray-700'} border px-2 py-1 rounded text-xs font-bold`}>{row.method}</span></td>
                                <td className="p-4 text-xs text-blue-500 hover:underline cursor-pointer">{row.block}</td>
                                <td className="p-4 text-gray-500 text-xs" title={new Date(row.timestamp).toLocaleString()}>{getAge(row.timestamp)}</td>
                                
                                <td className="p-4 relative">
                                    <span className={`inline-block px-2 py-1 rounded ${theme === 'light' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-900/30 text-indigo-300 border-indigo-800'} border font-mono text-xs font-bold truncate max-w-[140px] shadow-sm`} title={row.from}>
                                        {truncate(row.from)}
                                    </span>
                                    {baseAddresses.has(row.from.toLowerCase()) && <span className="absolute top-2 right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                                </td>
                                <td className="p-4 relative">
                                    <span className={`inline-block px-2 py-1 rounded ${theme === 'light' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' : 'bg-fuchsia-900/30 text-fuchsia-300 border-fuchsia-800'} border font-mono text-xs font-bold truncate max-w-[140px] shadow-sm`} title={row.to}>
                                        {truncate(row.to)}
                                    </span>
                                    {baseAddresses.has(row.to.toLowerCase()) && <span className="absolute top-2 right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                                </td>
                                
                                <td className="p-4 text-right">
                                    <span className={`font-mono font-black ${theme === 'light' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-emerald-400 bg-emerald-900/20 border-emerald-900'} px-2 py-1 rounded border`}>
                                        {row.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {activeType === 'native' ? 'ETH/TRX' : ''}
                                    </span>
                                </td>

                                {activeType === 'native' ? (
                                    <td className="p-4 text-right text-xs text-gray-500 tabular-nums">{row.fee?.toFixed(5)}</td>
                                ) : (
                                    <td className="p-4"><span className="text-xs font-bold text-purple-500">{row.token}</span></td>
                                )}
                                <td className="p-4 flex justify-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleStartEdit(row)} className="text-blue-500 hover:scale-110 transition-transform"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={16} /></button>
                                </td>
                            </>
                            )}
                        </MotionTr>
                        ))
                    )}
                </AnimatePresence>
                </tbody>
            </table>
          </div>
        ) : (
          <div className="h-full w-full">
             <textarea className="w-full h-full p-4 font-mono text-sm resize-none bg-gray-900 text-green-400 focus:outline-none" value={JSON.stringify(sortedData, null, 2)} readOnly />
          </div>
        )}
      </div>

      <AnimatePresence>
          {showFetchModal && (
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <MotionDiv initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} className={`${bgMain} border-4 ${borderMain} p-6 w-[500px] neo-shadow-lg relative max-h-[90vh] flex flex-col ${textMain}`}>
                      <button onClick={() => setShowFetchModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={20}/></button>
                      
                      <div className="flex items-center gap-3 mb-6 shrink-0">
                           <div className={`${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'} p-2`}><Network size={24} /></div>
                           <h3 className="text-xl font-black uppercase">Fetch On-Chain Data</h3>
                      </div>
                      
                      {fetchError && (
                          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm font-bold flex items-center gap-2 shrink-0">
                             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                             {fetchError}
                          </div>
                      )}

                      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                          <div>
                              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Blockchain Network</label>
                              <div className="relative">
                                  <select 
                                    value={fetchChainId}
                                    onChange={(e) => setFetchChainId(e.target.value)}
                                    className={`w-full border-2 ${borderMain} p-3 font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                                  >
                                      {SUPPORTED_CHAINS.map(chain => (
                                          <option key={chain.id} value={chain.id}>{chain.name} ({chain.currency})</option>
                                      ))}
                                  </select>
                                  <Network className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" size={16} />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1 pl-1">Supports Ethereum, Tron, L2s (Arbitrum, Optimism, Base...), and Testnets.</p>
                          </div>

                          <div>
                              <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Wallet Address(es) (Batch Support)</label>
                              <div className="relative shadow-sm">
                                <textarea 
                                    placeholder={fetchChainId === 'TRON' ? "Enter Tron addresses (one per line)...\nT...\nT..." : "Enter EVM addresses (one per line)...\n0x...\n0x..."}
                                    value={fetchAddress} 
                                    onChange={(e) => setFetchAddress(e.target.value)} 
                                    className="w-full bg-black text-white border-2 border-gray-700 p-4 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-600 shadow-inner h-32 resize-none custom-scrollbar" 
                                />
                              </div>
                              <p className="text-[10px] text-blue-500 font-bold mt-1 pl-1 flex items-center gap-1"><Target size={10} /> Note: These addresses will be automatically marked as Base/Target nodes.</p>
                          </div>

                          <div className={`border-t-2 ${theme === 'light' ? 'border-gray-100' : 'border-gray-800'} pt-4 mt-2`}>
                             <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div 
                                        className={`w-5 h-5 border-2 ${borderMain} flex items-center justify-center transition-colors ${useDateFilter ? (theme === 'light' ? 'bg-black' : 'bg-white') : ''}`}
                                        onClick={() => setUseDateFilter(!useDateFilter)}
                                    >
                                        {useDateFilter && <div className={`w-2 h-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}></div>}
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter By Date (Last 15 Days Default)</span>
                                </label>
                                <CalendarClock className="text-gray-400" size={16} />
                             </div>

                             <AnimatePresence>
                                {useDateFilter && (
                                    <MotionDiv initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3 pl-1">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From</label>
                                                <div className="relative">
                                                    <input 
                                                        type="date" 
                                                        value={fetchStartDate}
                                                        onChange={(e) => setFetchStartDate(e.target.value)}
                                                        className="w-full bg-black text-white border-2 border-gray-700 p-3 text-sm font-bold focus:outline-none focus:border-blue-600 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">To</label>
                                                <div className="relative">
                                                    <input 
                                                        type="date" 
                                                        value={fetchEndDate}
                                                        onChange={(e) => setFetchEndDate(e.target.value)}
                                                        className="w-full bg-black text-white border-2 border-gray-700 p-3 text-sm font-bold focus:outline-none focus:border-blue-600 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </MotionDiv>
                                )}
                             </AnimatePresence>
                             {!useDateFilter && <p className="text-[10px] text-orange-500 font-bold mt-1 pl-1">Warning: Fetching without date limits will retrieve the latest 1000 records.</p>}
                          </div>

                          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800 font-medium">
                              <p className="font-bold mb-1">Query Info:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                  <li>Fetches up to 1000 latest native transactions.</li>
                                  <li>Fetches up to 1000 latest ERC20/TRC20 token transfers.</li>
                                  <li>Synced to your personal data vault.</li>
                              </ul>
                          </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-8 shrink-0">
                          <button onClick={() => setShowFetchModal(false)} className={`px-6 py-3 font-bold hover:bg-gray-100/10 border-2 border-transparent transition-colors ${textMain}`}>Cancel</button>
                          <button 
                            onClick={handleFetch} 
                            disabled={isFetching || !fetchAddress}
                            className={`px-8 py-3 bg-blue-600 text-white font-bold border-2 ${borderMain} neo-shadow-hover transition-all flex items-center gap-2
                                ${isFetching || !fetchAddress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500'}
                            `}
                          >
                              {isFetching && <Loader2 className="animate-spin" size={18} />}
                              {isFetching ? 'Fetching...' : 'Fetch All Data'}
                          </button>
                      </div>
                  </MotionDiv>
              </MotionDiv>
          )}
      </AnimatePresence>

    </div>
  );
};

export default DataEditor;