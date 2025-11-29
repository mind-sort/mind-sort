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

  const fetchNudge = async () => {
    // Prevent double loading
    if (loading) return;
    
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
    
    // Refresh every 30 minutes to save API quota
    const interval = setInterval(fetchNudge, 30 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customQuotes]); 

  if (!nudge && !loading) return null;

  return (
    <div className={`w-full max-w-2xl mx-auto transition-all duration-700 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex flex-col items-center justify-center py-2 px-4">
             <button 
                onClick={fetchNudge}
                disabled={loading}
                className="group relative"
                title="Refresh thought"
            >
                <p className="text-center font-serif text-xl md:text-2xl text-slate-300 leading-relaxed italic hover:text-white transition-colors">
                    {loading ? "..." : `"${nudge?.message}"`}
                </p>
                
                {/* Subtle underline decoration */}
                <div className="h-px w-12 bg-slate-700 mx-auto mt-3 group-hover:w-24 transition-all duration-300 group-hover:bg-slate-500"></div>
            </button>
        </div>
    </div>
  );
};