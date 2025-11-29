import React, { useEffect, useState } from 'react';
import { getReadingSuggestion } from '../services/gemini';
import { Item, ReadingSuggestion, Category } from '../types';

interface ReadingWidgetProps {
  items: Item[];
  blogSources: string[];
}

export const ReadingWidget: React.FC<ReadingWidgetProps> = ({ items, blogSources }) => {
  const [suggestion, setSuggestion] = useState<ReadingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestion = async () => {
    setLoading(true);
    try {
        const readItems = items
            .filter(i => i.category === Category.READ)
            .map(i => i.text);
            
        const result = await getReadingSuggestion(readItems, blogSources);
        
        if (result && result.length > 0) {
            // Pick a random suggestion from the batch to keep it fresh even with caching
            setSuggestion(result[Math.floor(Math.random() * result.length)]);
        }
    } catch (e) {
        // quiet fail
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogSources]); // Re-fetch if sources change

  return (
    <div className="w-full h-full relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
        
        <div className="relative h-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
            
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-blue-300">
                    <span className="text-xl">📖</span>
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Smart Reader</h3>
                </div>
                <button 
                    onClick={fetchSuggestion} 
                    disabled={loading}
                    className={`text-slate-500 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh suggestion"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col justify-center space-y-3 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                </div>
            ) : suggestion ? (
                <div className="flex flex-col gap-2">
                    <a 
                        href={suggestion.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group/link block"
                    >
                        <h4 className="text-lg font-medium text-slate-200 group-hover/link:text-blue-400 transition-colors line-clamp-2 leading-tight flex items-start gap-2">
                            {suggestion.title}
                            <svg className="w-4 h-4 mt-1 opacity-50 group-hover/link:opacity-100 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </h4>
                    </a>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-blue-300/80">{suggestion.source}</span>
                    </div>
                    
                    <p className="text-xs text-slate-500 italic mt-2 border-l-2 border-slate-700 pl-2">
                        "{suggestion.reason}"
                    </p>
                </div>
            ) : (
                <div className="text-slate-500 text-sm">No suggestions yet.</div>
            )}
        </div>
    </div>
  );
};