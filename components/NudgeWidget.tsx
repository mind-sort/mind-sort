import React, { useEffect, useState } from 'react';
import { generateNudge } from '../services/gemini';
import { Item, NudgeResult } from '../types';

interface NudgeWidgetProps {
  items: Item[];
  customQuotes: string[];
}

export const NudgeWidget: React.FC<NudgeWidgetProps> = ({ items, customQuotes }) => {
  const [nudge, setNudge] = useState<NudgeResult | null>(null);

  const fetchNudge = async () => {
    const result = await generateNudge(items, customQuotes);
    setNudge(result);
  };

  useEffect(() => {
    fetchNudge();
    const interval = setInterval(fetchNudge, 300000); 
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customQuotes]); 

  if (!nudge) return null;

  return (
    <div className="w-full max-w-xl mx-auto animate-[fadeIn_0.5s_ease-out]">
        <div className="flex flex-col items-center justify-center">
             <button 
                onClick={fetchNudge}
                className="group relative px-4"
                title="New quote"
            >
                <p className="text-center font-serif text-lg text-slate-400 italic hover:text-slate-200 transition-colors leading-tight">
                    "{nudge.message}"
                </p>
            </button>
        </div>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
    </div>
  );
};