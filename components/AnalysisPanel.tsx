import React, { useState } from 'react';
import { Transaction, GeminiAnalysisResponse, TxType } from '../types';
import { analyzeChainData } from '../services/geminiService';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, CheckCircle, Activity, Search, ShieldAlert, TrendingUp } from 'lucide-react';

interface AnalysisPanelProps {
  data: Transaction[];
  activeType: TxType;
  theme: 'light' | 'dark';
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, activeType, theme }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeminiAnalysisResponse | null>(null);

  const filteredData = data.filter(t => t.type === activeType);

  const bgMain = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
  const bgSub = theme === 'light' ? 'bg-gray-50' : 'bg-[#111]';
  const borderMain = theme === 'light' ? 'border-black' : 'border-gray-600';
  const textMain = theme === 'light' ? 'text-black' : 'text-gray-100';
  const textSub = theme === 'light' ? 'text-gray-600' : 'text-gray-400';

  const handleAnalyze = async () => {
    if (filteredData.length === 0) return;
    setLoading(true);
    const res = await analyzeChainData(filteredData, activeType);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Left Control Panel */}
      <div className="lg:w-1/3 flex flex-col gap-6">
        <div className={`${bgMain} p-6 border-4 ${borderMain} neo-shadow relative overflow-hidden`}>
           <div className={`absolute top-[-20px] right-[-20px] w-32 h-32 rounded-full blur-xl opacity-50 ${activeType === 'native' ? 'bg-blue-300' : 'bg-purple-300'}`}></div>
           
           <div className={`relative z-10 ${textMain}`}>
                <h2 className="text-3xl font-black mb-1 italic">AI INSIGHT ENGINE</h2>
                <span className={`inline-block px-2 py-0.5 text-xs font-bold border ${borderMain} mb-4 ${activeType === 'native' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                    MODE: {activeType.toUpperCase()} ANALYSIS
                </span>
                
                <p className={`${textSub} mb-6 font-mono text-sm`}>
                    Deploying Gemini 2.5 Flash to detect anomalies, wash trading, and accumulation patterns in your <strong>{activeType}</strong> dataset.
                </p>
                
                <div className="space-y-2 mb-6">
                    <div className={`flex justify-between text-sm font-bold border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'} pb-2`}>
                        <span>Dataset Scope</span>
                        <span>{filteredData.length} Transactions</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'} pb-2`}>
                        <span>Est. Processing</span>
                        <span className="text-blue-600">~1.2s</span>
                    </div>
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={loading || filteredData.length === 0}
                    className={`w-full py-4 font-black text-xl uppercase tracking-widest border-2 ${borderMain} transition-all relative
                        ${loading || filteredData.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-400 hover:bg-green-300 neo-shadow-hover active:translate-y-1 text-black'}
                    `}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Activity className="animate-spin" /> Computing...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <Sparkles /> Analyze {activeType}
                        </span>
                    )}
                </button>
           </div>
        </div>

        {/* Global Trend Card */}
        {result && (
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`p-6 border-4 ${borderMain} neo-shadow flex-1 flex flex-col justify-center ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'}`}
            >
                <div className="flex items-center gap-2 mb-2 text-yellow-500">
                    <TrendingUp size={20} />
                    <h3 className="text-xs font-bold uppercase">Market Sentiment</h3>
                </div>
                <p className="text-lg font-serif leading-relaxed italic">"{result.globalTrend}"</p>
            </motion.div>
        )}
      </div>

      {/* Right Results Grid */}
      <div className={`lg:w-2/3 ${bgSub} border-4 ${borderMain} p-6 overflow-y-auto neo-shadow custom-scrollbar relative`}>
        {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                <Search size={64} className="mb-4" />
                <p className="text-xl font-black uppercase">Ready for Analysis</p>
                <p className="text-sm font-mono mt-2">Select a dataset and run the engine.</p>
            </div>
        )}

        {loading && (
             <div className={`h-full flex flex-col items-center justify-center ${textMain}`}>
                <div className="flex gap-2">
                    <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-4 h-4 bg-blue-600 border border-black"></motion.div>
                    <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-4 h-4 bg-pink-600 border border-black"></motion.div>
                    <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-4 h-4 bg-yellow-400 border border-black"></motion.div>
                </div>
                <p className="mt-6 font-mono font-bold text-lg">Deconstructing {activeType} Flows...</p>
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
            {result?.insights.map((insight, idx) => (
                <motion.div
                    key={idx}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`${bgMain} border-2 ${borderMain} p-4 hover:shadow-lg transition-shadow group`}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className={`px-2 py-1 border ${borderMain} text-xs font-mono font-bold truncate max-w-[150px] ${theme === 'light' ? 'bg-gray-100 text-black' : 'bg-gray-800 text-white'}`}>
                            {insight.address}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 border ${borderMain} text-xs font-bold uppercase
                            ${insight.riskScore > 70 ? 'bg-red-500 text-white' : insight.riskScore > 30 ? 'bg-yellow-300 text-black' : 'bg-green-300 text-black'}
                        `}>
                           {insight.riskScore > 70 ? <ShieldAlert size={12} /> : <CheckCircle size={12} />}
                           RISK: {insight.riskScore}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                        {insight.tags.map((tag, tIdx) => (
                            <span key={tIdx} className={`px-2 py-0.5 text-xs font-bold border ${borderMain} transform group-hover:rotate-1 transition-transform cursor-default ${theme === 'light' ? 'bg-blue-100 text-blue-800' : 'bg-blue-900/40 text-blue-200'}`}>
                                #{tag}
                            </span>
                        ))}
                    </div>

                    <p className={`text-sm font-medium leading-snug border-l-2 pl-3 ${theme === 'light' ? 'text-gray-700 border-gray-300' : 'text-gray-300 border-gray-700'}`}>
                        {insight.behaviorSummary}
                    </p>
                </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;