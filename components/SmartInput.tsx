import React, { useState, useRef } from 'react';
import { classifyInput } from '../services/gemini';
import { Item, Category } from '../types';

interface SmartInputProps {
  onAddItem: (item: Item) => void;
}

export const SmartInput: React.FC<SmartInputProps> = ({ onAddItem }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && text.trim() && !isProcessing) {
      setIsProcessing(true);
      try {
        const result = await classifyInput(text);
        
        let deadlineTimestamp: number | undefined = undefined;
        if (result.deadline) {
            const date = new Date(result.deadline);
            if (!isNaN(date.getTime())) {
                deadlineTimestamp = date.getTime();
            }
        }

        const newItem: Item = {
          id: crypto.randomUUID(),
          text: result.refinedText,
          category: result.category,
          createdAt: Date.now(),
          completed: false,
          deadline: deadlineTimestamp,
          notifiedStages: []
        };
        
        onAddItem(newItem);
        setText('');
      } catch (error) {
        console.error("Failed to add item", error);
      } finally {
        setIsProcessing(false);
        // Keep focus
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-12 relative z-10">
      <div className={`relative transition-all duration-300 transform ${isProcessing ? 'scale-[0.99] opacity-90' : 'scale-100'}`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type anything... 'Buy milk tomorrow at 5pm', 'Read Dune'..."
          className="w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 text-slate-100 text-xl px-8 py-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-500 shadow-2xl transition-all"
          disabled={isProcessing}
        />
        
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
            {isProcessing && (
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium animate-pulse">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sorting...</span>
                </div>
            )}
            {!isProcessing && text.length > 0 && (
                <span className="text-slate-500 text-sm font-medium">Press Enter ↵</span>
            )}
        </div>
      </div>
    </div>
  );
};