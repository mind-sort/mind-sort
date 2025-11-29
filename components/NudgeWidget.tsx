import React, { useEffect, useState } from 'react';
import { generateNudge } from '../services/gemini';
import { Item, NudgeResult } from '../types';

interface NudgeWidgetProps {
  items: Item[];
  customQuotes: string[];
}

export const NudgeWidget: React.FC<NudgeWidgetProps> = ({ items, customQuotes }) => {
  const [nudge, setNudge] = useState<NudgeResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to get color based on nudge type
  const getTypeStyles = (type?: string) => {
    switch(type) {
        case 'motivation': return 'from-orange-500/20 to-amber-500/20 text-amber-200 border-amber-500/30';
        case 'reminder': return 'from-blue-500/20 to-cyan-500/20 text-cyan-200 border-cyan-500/30';
        case 'wisdom': return 'from-purple-500/20 to-indigo-500/20 text-indigo-200 border-indigo-500/30';
        default: return 'from-slate-700/50 to-slate-800/50 text-slate-300 border-slate-700';
    }
  };

  const fetchNudge = async () => {
    setLoading(true);
    try {
        const result = await generateNudge(items, customQuotes);
        setNudge(result);
    } catch (e) {
        // quiet fail
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchNudge();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNudge, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customQuotes]); 

  if (!nudge && !loading) return null;

  return (
    <div className={`w-full max-w-2xl mx-auto mb-8 transition-all duration-700 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <div className={`relative overflow-hidden rounded-2xl border p-1 ${getTypeStyles(nudge?.type)}`}>
            {/* Background Gradient Mesh */}
            <div className={`absolute inset-0 bg-gradient-to-r ${getTypeStyles(nudge?.type)} opacity-50 blur-xl`}></div>
            
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-slate-800/50 border border-white/10">
                        {nudge?.type === 'motivation' && '🔥'}
                        {nudge?.type === 'reminder' && '⏰'}
                        {nudge?.type === 'wisdom' && '🧘'}
                        {loading && '✨'}
                    </div>
                    <p className="font-medium text-lg italic tracking-wide">
                        {loading ? "Consulting the oracle..." : `"${nudge?.message}"`}
                    </p>
                </div>
                
                <button 
                    onClick={fetchNudge}
                    disabled={loading}
                    className="p-2 text-white/20 hover:text-white/60 transition-colors"
                    title="Get new nudge"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
  );
};