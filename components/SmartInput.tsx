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

  const handleSubmit = async () => {
    if (text.trim() && !isProcessing) {
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

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative z-10">
      <div className={`relative transition-all duration-300 transform ${isProcessing ? 'scale-[0.99] opacity-90' : 'scale-100'}`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type anything... 'Buy milk tomorrow at 5pm', 'Read Dune'..."
          className="w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 text-slate-100 text-xl px-8 py-6 pr-32 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-500 shadow-2xl transition-all"
          disabled={isProcessing}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isProcessing && (
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium animate-pulse mr-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Sorting...</span>
                </div>
            )}
            
            <button
                onClick={handleSubmit}
                disabled={!text.trim() || isProcessing}
                className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
                    text.trim() && !isProcessing
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-indigo-500/30 active:scale-95' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};