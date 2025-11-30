import React, { useState, useRef, useEffect } from 'react';
import { classifyInput } from '../services/gemini';
import { Item } from '../types';

interface SmartInputProps {
  onAddItem: (item: Item) => void;
  apiKey: string;
  onRequestKey: () => void;
  onApiError: (errorType: string) => void;
}

// Polyfill for TypeScript
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export const SmartInput: React.FC<SmartInputProps> = ({ onAddItem, apiKey, onRequestKey, onApiError }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const baseTextRef = useRef(''); // Stores text before voice session started
  const textRef = useRef(text); // Keeps track of latest text for callbacks

  // Update textRef whenever text changes
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // 1. Define stopListening first so it's available to other functions
  const stopListening = () => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    setIsListening(false);
    if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
    }
  };

  // 2. Define handleSubmit (uses stopListening)
  const handleSubmit = async (submitText: string = text) => {
    if (submitText.trim() && !isProcessing) {
      
      // Check API Key first
      if (!apiKey) {
        stopListening();
        onRequestKey();
        return;
      }

      // Ensure we stop listening if submitting
      if (recognitionRef.current) {
        stopListening();
      }

      setIsProcessing(true);
      try {
        const result = await classifyInput(submitText, apiKey);
        
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
      } catch (error: any) {
        console.error("Failed to add item", error);
        if (error.message === "AUTH_ERROR" || error.message === "QUOTA_ERROR") {
            onApiError(error.message);
        }
      } finally {
        setIsProcessing(false);
        // Small delay to allow render update before focus
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSubmit();
    }
  };

  // 3. Define startListening (uses stopListening and handleSubmit)
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice input is not supported in this browser. Please use Chrome.");
        return;
    }

    // Capture current text so we append speech to it
    baseTextRef.current = text;
    
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }

        // Update UI with existing text + new speech
        const separator = baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : '';
        const newText = baseTextRef.current + separator + transcript;
        setText(newText);

        // Reset silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            console.log("Silence detected, auto-submitting...");
            stopListening();
            handleSubmit(textRef.current); 
        }, 5000);
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        stopListening();
    };

    recognition.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleListening = () => {
      if (isListening) {
          stopListening();
      } else {
          startListening();
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
          placeholder={isListening ? "Listening..." : "Type anything..."}
          className={`w-full bg-slate-800/50 backdrop-blur-xl border text-slate-100 text-base px-4 py-3 pr-28 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-slate-500 shadow-xl transition-all ${isListening ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-700'}`}
          disabled={isProcessing}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            
            {/* Voice Button */}
            <button
                onClick={toggleListening}
                disabled={isProcessing}
                className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center relative ${
                    isListening 
                    ? 'bg-red-500/20 text-red-400 animate-pulse' 
                    : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="Voice Input"
            >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isListening && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isProcessing && (
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium animate-pulse mr-1">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
            
            <button
                onClick={() => handleSubmit()}
                disabled={!text.trim() || isProcessing}
                className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
                    text.trim() && !isProcessing
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-indigo-500/30 active:scale-95' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};