import React, { useEffect, useState } from 'react';
import { getReadingSuggestion } from '../services/gemini';
import { Item, ReadingSuggestion, Category } from '../types';

interface ReadingWidgetProps {
  items: Item[];
  blogSources: string[];
  readHistory: string[];
  onMarkRead: (url: string) => void;
  apiKey: string;
}

export const ReadingWidget: React.FC<ReadingWidgetProps> = ({ items, blogSources, readHistory, onMarkRead, apiKey }) => {
  const [suggestions, setSuggestions] = useState<ReadingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async (force: boolean = false) => {
    setLoading(true);
    try {
        // Pass force flag and read history to service
        const result = await getReadingSuggestion(readHistory, blogSources, force, apiKey);
        if (result && result.length > 0) {
            setSuggestions(result);
        }
    } catch (e) {
        // quiet fail
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load: do NOT force refresh, use cache if available
    fetchSuggestions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogSources, readHistory.length, apiKey]); 
  // Re-run if readHistory changes length (item marked read) to potentially fetch more? 
  // Actually, we usually just want to filter visually, but refetching ensures we fill the slots if needed.

  const handleCheck = (url: string) => {
    onMarkRead(url);
    // Optimistically remove from view immediately
    setSuggestions(prev => prev.filter(s => s.url !== url));
  };

  return (
    <div className="w-full h-full relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 rounded-2xl"></div>
        
        <div className="relative h-full bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 flex flex-col hover:border-slate-600 transition-colors">
            
            <div className="flex justify-between items-start mb-2 flex-none">
                <div className="flex items-center gap-2 text-blue-300">
                    <span className="text-sm">📖</span>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-80">Recommended Reads</h3>
                </div>
                <button 
                    onClick={() => fetchSuggestions(true)} 
                    disabled={loading}
                    className={`text-slate-500 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh suggestions"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {loading && suggestions.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-full"></div>
                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                </div>
            ) : suggestions.length > 0 ? (
                <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1">
                    {suggestions.map((item) => (
                        <div key={item.url} className="flex items-start gap-2 group/item">
                            <button 
                                onClick={() => handleCheck(item.url)}
                                className="mt-0.5 w-3.5 h-3.5 rounded border border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/20 flex-shrink-0 transition-colors"
                                title="Mark as read (don't show again)"
                            ></button>
                            
                            <div className="min-w-0 flex-1">
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block text-xs text-slate-300 hover:text-blue-400 truncate leading-tight transition-colors"
                                    title={item.title}
                                >
                                    {item.title}
                                </a>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] text-slate-500">{item.source}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-slate-500 text-xs flex-1 flex items-center justify-center italic">
                    All caught up!
                </div>
            )}
        </div>
    </div>
  );
};