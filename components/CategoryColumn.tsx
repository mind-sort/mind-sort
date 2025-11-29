import React, { useEffect, useState } from 'react';
import { Item, Category, LinkPreviewData } from '../types';
import { getLinkPreview } from '../services/gemini';

interface CategoryColumnProps {
  title: string;
  category: Category;
  items: Item[];
  icon: string;
  colorClass: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Item>) => void;
  onMoveItem: (id: string, newCategory: Category) => void;
}

export const CategoryColumn: React.FC<CategoryColumnProps> = ({ 
  title, 
  items, 
  icon, 
  colorClass,
  category,
  onToggle, 
  onDelete,
  onUpdate,
  onMoveItem
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  
  const activeItems = items.filter(i => !i.completed).sort((a, b) => {
      // Sort by deadline if available, otherwise by creation
      if (a.deadline && b.deadline) return a.deadline - b.deadline;
      if (a.deadline) return -1; // Deadlines first
      if (b.deadline) return 1;
      return b.createdAt - a.createdAt;
  });
  
  const completedItems = items.filter(i => i.completed).sort((a, b) => b.createdAt - a.createdAt);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we are actually leaving the container, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const itemId = e.dataTransfer.getData("text/plain");
    if (itemId) {
        onMoveItem(itemId, category);
    }
  };

  return (
    <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col h-full rounded-3xl p-6 border transition-all duration-300 ${
            isDragOver 
            ? 'bg-slate-700/60 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] scale-[1.02]' 
            : 'bg-slate-800/30 border-slate-700/50 backdrop-blur-sm hover:border-slate-600/50'
        }`}
    >
      <div className="flex items-center gap-3 mb-6 pointer-events-none">
        <div className={`p-3 rounded-xl bg-slate-800 border border-slate-700 ${colorClass} shadow-lg`}>
          <span className="text-xl">{icon}</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-200 tracking-wide">{title}</h2>
        <span className="ml-auto bg-slate-800 text-slate-400 text-xs font-bold px-2 py-1 rounded-full border border-slate-700">
          {activeItems.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {activeItems.length === 0 && completedItems.length === 0 && (
            <div className={`h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors ${isDragOver ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-slate-800 text-slate-500'}`}>
                <span className="text-sm">{isDragOver ? "Drop here!" : "Empty"}</span>
            </div>
        )}

        {activeItems.map(item => (
          <ItemCard key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />
        ))}
        
        {completedItems.length > 0 && (
            <>
                <div className="border-t border-slate-700/50 my-4 pt-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">
                    Completed
                </div>
                {completedItems.map(item => (
                    <ItemCard key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isCompleted />
                ))}
            </>
        )}
      </div>
    </div>
  );
};

const ItemCard: React.FC<{ 
    item: Item, 
    onToggle: (id: string) => void, 
    onDelete: (id: string) => void,
    onUpdate: (id: string, updates: Partial<Item>) => void,
    isCompleted?: boolean 
}> = ({ item, onToggle, onDelete, onUpdate, isCompleted }) => {
    
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    // Extract first URL if present
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = item.text.match(urlRegex);
    const firstUrl = urlMatch ? urlMatch[0] : null;

    useEffect(() => {
        // If we have a URL, but no linkPreview data yet (and it hasn't failed ie null), fetch it.
        // If item.linkPreview is undefined, we fetch. If it is null, we tried and failed, so stop.
        if (firstUrl && item.linkPreview === undefined && !isLoadingPreview && !isCompleted) {
            setIsLoadingPreview(true);
            getLinkPreview(firstUrl)
                .then(data => {
                    onUpdate(item.id, { linkPreview: data });
                })
                .catch(() => {
                    onUpdate(item.id, { linkPreview: null });
                })
                .finally(() => {
                    setIsLoadingPreview(false);
                });
        }
    }, [firstUrl, item.linkPreview, item.id, onUpdate, isLoadingPreview, isCompleted]);


    // Formatting date
    let deadlineNode = null;
    if (item.deadline && !isCompleted) {
        const date = new Date(item.deadline);
        const now = new Date();
        const diffMs = item.deadline - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        
        let colorClass = "text-slate-400 bg-slate-800";
        let text = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        if (diffMs < 0) {
            colorClass = "text-red-300 bg-red-500/20 border-red-500/30";
            text = "Overdue";
        } else if (diffHrs < 1) {
            colorClass = "text-red-300 bg-red-500/20 border-red-500/30 animate-pulse";
            text = "Due in < 1h";
        } else if (diffHrs < 24) {
             colorClass = "text-orange-300 bg-orange-500/20 border-orange-500/30";
             text = "Due today/tmrw";
        }

        if (diffHrs > 24) {
             text = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
        }

        deadlineNode = (
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colorClass} inline-block mb-1`}>
                {text}
            </div>
        );
    }

    const renderTextWithLinks = (text: string) => {
        const parts = text.split(urlRegex);
        return parts.map((part, index) => {
            if (part.match(urlRegex)) {
                return (
                    <a 
                        key={index} 
                        href={part} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-400 hover:text-blue-300 hover:underline inline-block max-w-[200px] truncate align-bottom relative z-10"
                        title={part}
                        onClick={(e) => e.stopPropagation()} 
                    >
                        {part}
                    </a>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        // Make element partially transparent while dragging
        // e.currentTarget.style.opacity = '0.5'; 
    };

    return (
        <div 
            draggable={!isCompleted}
            onDragStart={handleDragStart}
            className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                isCompleted 
                ? 'bg-slate-900/50 border-slate-800 opacity-60' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:shadow-lg hover:-translate-y-0.5 cursor-grab active:cursor-grabbing'
            }`}
        >
            {deadlineNode}
            <div className="flex items-start gap-3">
                <button 
                    onClick={() => onToggle(item.id)}
                    className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border transition-colors flex items-center justify-center ${
                        isCompleted 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' 
                        : 'border-slate-500 hover:border-emerald-400'
                    }`}
                >
                    {isCompleted && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
                <div className="w-full overflow-hidden">
                    <div className={`text-sm leading-relaxed break-words w-full ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {renderTextWithLinks(item.text)}
                    </div>

                    {/* Compact Link Attachment */}
                    {item.linkPreview && !isCompleted && (
                        <a 
                            href={item.linkPreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-3 bg-slate-900/40 border border-slate-700/40 rounded-lg p-2 hover:bg-slate-900 hover:border-blue-500/30 transition-all group/card max-w-full relative z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img 
                                src={`https://www.google.com/s2/favicons?domain=${new URL(item.linkPreview.url).hostname}&sz=32`} 
                                alt="" 
                                className="w-4 h-4 rounded-sm opacity-80 flex-shrink-0" 
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-xs font-medium text-slate-300 group-hover/card:text-blue-300 truncate transition-colors leading-tight">
                                    {item.linkPreview.title}
                                </h4>
                                <span className="text-[10px] text-slate-500 truncate leading-tight">
                                    {item.linkPreview.siteName || new URL(item.linkPreview.url).hostname}
                                </span>
                            </div>
                            <svg className="w-3 h-3 text-slate-600 group-hover/card:text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )}
                    
                    {isLoadingPreview && (
                        <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-2 animate-pulse">
                            <span className="w-2 h-2 rounded-full border border-slate-500 border-t-transparent animate-spin"></span>
                            Loading metadata...
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={() => onDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-1 -mt-1 -mr-1"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};