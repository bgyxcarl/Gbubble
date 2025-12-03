
import React, { useState, useEffect } from 'react';
import { Tab, Transaction, TxType } from './types';
import DataEditor from './components/DataEditor';
import BubbleViz from './components/BubbleViz';
import AnalysisPanel from './components/AnalysisPanel';
import AuthOverlay from './components/AuthOverlay';
import { dataService, Label } from './services/backendService';
import { LayoutGrid, Activity, BrainCircuit, Database, Sun, Moon, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const App: React.FC = () => {
  const [user, setUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DATA);
  const [activeType, setActiveType] = useState<TxType>('native');
  const [data, setData] = useState<Transaction[]>([]);
  
  // Backend State
  const [sharedLabels, setSharedLabels] = useState<Label[]>([]);

  // Base/Target Addresses State (Nodes marked as '0')
  const [baseAddresses, setBaseAddresses] = useState<Set<string>>(new Set());
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
      // Check for existing session
      const token = localStorage.getItem('chainscope_token');
      const username = localStorage.getItem('chainscope_user');
      if (token && username) {
          setUser(username);
          loadBackendData();
      }
  }, []);

  const loadBackendData = async () => {
      const dbData = await dataService.getUserData();
      const labels = await dataService.getLabels();
      
      // Merge Backend Data
      setData([...dbData.native, ...dbData.erc20]);
      setSharedLabels(labels);
  };

  const handleLogin = (username: string) => {
      setUser(username);
      loadBackendData();
  };

  const handleLogout = () => {
      localStorage.removeItem('chainscope_token');
      localStorage.removeItem('chainscope_user');
      setUser(null);
      setData([]);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Sync new data to backend
  const handleAddData = async (newTxns: Transaction[]) => {
      // Optimistic update
      setData(prev => [...newTxns, ...prev]);
      
      // Determine type based on first item (batch usually same type)
      if (newTxns.length > 0) {
          const type = newTxns[0].type;
          // Filter to ensure strictly one type per batch sync if needed, 
          // but our backend handles batch well.
          // We assume handleAddData receives uniform batches or we split them.
          const natives = newTxns.filter(t => t.type === 'native');
          const erc20s = newTxns.filter(t => t.type === 'erc20');
          
          if(natives.length > 0) await dataService.syncTransactions(natives, 'native');
          if(erc20s.length > 0) await dataService.syncTransactions(erc20s, 'erc20');
      }
  };

  // Background Styles
  const bgClass = theme === 'light' ? 'bg-[#f8f8f8]' : 'bg-[#0a0a0a]';
  const textClass = theme === 'light' ? 'text-black' : 'text-gray-100';
  const borderClass = theme === 'light' ? 'border-black' : 'border-white/20';

  if (!user) {
      return <AuthOverlay onLogin={handleLogin} theme={theme} />;
  }

  return (
    <div className={`min-h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-white text-black' : 'bg-black text-white'}`}>
      
      {/* Header / Nav */}
      <header className={`border-b-4 ${borderClass} ${theme === 'light' ? 'bg-white' : 'bg-[#111]'} p-4 flex justify-between items-center z-50 relative`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${theme === 'light' ? 'bg-blue-600 border-black' : 'bg-blue-500 border-white'} border-2 flex items-center justify-center neo-shadow-sm transform hover:rotate-12 transition-transform`}>
                <Activity className="text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-black tracking-tighter italic leading-none">CHAIN<span className="text-blue-500">SCOPE</span>_V2</h1>
                <p className="text-[10px] font-mono font-bold text-gray-500">DATA VAULT: {user.toUpperCase()}</p>
            </div>
        </div>

        <nav className={`flex ${theme === 'light' ? 'bg-gray-100' : 'bg-[#222]'} p-1 border-2 ${borderClass} gap-2`}>
            {[
                { id: Tab.DATA, icon: Database, label: 'SOURCE' },
                { id: Tab.VISUALIZE, icon: LayoutGrid, label: 'VISUALIZE' },
                { id: Tab.ANALYSIS, icon: BrainCircuit, label: 'INTELLIGENCE' },
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                        flex items-center gap-2 px-4 py-2 font-bold text-sm transition-all border-2 border-transparent
                        ${activeTab === item.id 
                            ? `${theme === 'light' ? 'bg-white border-black text-black' : 'bg-black border-white text-white'} neo-shadow-sm transform -translate-y-1` 
                            : 'text-gray-500 hover:text-gray-400 hover:bg-gray-200/10'}
                    `}
                >
                    <item.icon size={16} />
                    {item.label}
                </button>
            ))}
        </nav>

        <div className="flex gap-4 items-center">
             {/* Theme Toggle */}
            <button onClick={toggleTheme} className={`p-2 border-2 ${borderClass} hover:bg-gray-200/20 transition-colors`}>
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="flex gap-2 items-center border-l pl-4 border-gray-700">
                <button onClick={handleLogout} className="text-xs font-bold uppercase text-red-500 hover:underline flex items-center gap-1">
                    <LogOut size={14}/> Logout
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 relative p-6 ${bgClass} overflow-hidden`}>
        {/* Decorative Background Elements */}
        <div className={`absolute top-10 left-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob ${theme === 'light' ? 'bg-pink-200' : 'bg-pink-900 mix-blend-screen'}`}></div>
        <div className={`absolute top-10 right-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 ${theme === 'light' ? 'bg-yellow-200' : 'bg-yellow-900 mix-blend-screen'}`}></div>
        <div className={`absolute bottom-10 left-20 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 ${theme === 'light' ? 'bg-blue-200' : 'bg-blue-900 mix-blend-screen'}`}></div>

        <div className="relative z-10 h-full">
            {activeTab === Tab.DATA && (
                <motion.div 
                    initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} 
                    className="h-full"
                >
                    <DataEditor 
                        data={data} 
                        setData={setData} 
                        activeType={activeType}
                        setActiveType={setActiveType}
                        theme={theme}
                        baseAddresses={baseAddresses}
                        setBaseAddresses={setBaseAddresses}
                        onSyncBackend={handleAddData}
                    />
                </motion.div>
            )}
            
            {activeTab === Tab.VISUALIZE && (
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
                    className="h-full"
                >
                    <BubbleViz 
                        data={data} 
                        activeType={activeType}
                        setActiveType={setActiveType}
                        onAddData={handleAddData}
                        theme={theme}
                        baseAddresses={baseAddresses}
                        sharedLabels={sharedLabels}
                        refreshLabels={() => dataService.getLabels().then(setSharedLabels)}
                    />
                </motion.div>
            )}

            {activeTab === Tab.ANALYSIS && (
                <motion.div 
                    initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} 
                    className="h-full"
                >
                    <AnalysisPanel 
                        data={data} 
                        activeType={activeType}
                        theme={theme}
                    />
                </motion.div>
            )}
        </div>
      </main>
      
      <style>{`
        @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
            animation: blob 7s infinite;
        }
        .animation-delay-2000 {
            animation-delay: 2s;
        }
        .animation-delay-4000 {
            animation-delay: 4s;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: ${theme === 'light' ? '#f1f1f1' : '#333'}; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: ${theme === 'light' ? '#000' : '#888'}; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: ${theme === 'light' ? '#333' : '#aaa'}; 
        }
      `}</style>
    </div>
  );
};

export default App;
