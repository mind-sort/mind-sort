import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  blogSources: string[];
  setBlogSources: (blogs: string[]) => void;
  customQuotes: string[];
  setCustomQuotes: (quotes: string[]) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, blogSources, setBlogSources, customQuotes, setCustomQuotes, apiKey, setApiKey
}) => {
    const [activeTab, setActiveTab] = useState<'connection' | 'blogs' | 'quotes'>('connection');
    const [newBlog, setNewBlog] = useState('');
    const [newQuote, setNewQuote] = useState('');
    const [tempKey, setTempKey] = useState(apiKey);
    const [showKey, setShowKey] = useState(false);

    if (!isOpen) return null;

    const handleSaveKey = () => {
        setApiKey(tempKey);
        // Visual feedback could be added here
    };

    const handleRemoveKey = () => {
        setApiKey('');
        setTempKey('');
    };

    const handleAddBlog = () => {
        if (newBlog.trim()) {
            setBlogSources([...blogSources, newBlog.trim()]);
            setNewBlog('');
        }
    };

    const handleAddQuote = () => {
        if (newQuote.trim()) {
            setCustomQuotes([...customQuotes, newQuote.trim()]);
            setNewQuote('');
        }
    };

    const removeBlog = (index: number) => {
        setBlogSources(blogSources.filter((_, i) => i !== index));
    };

    const removeQuote = (index: number) => {
        setCustomQuotes(customQuotes.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                    <h2 className="text-xl font-bold text-slate-100">Settings</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setActiveTab('connection')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'connection' ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Connection
                    </button>
                    <button 
                        onClick={() => setActiveTab('blogs')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'blogs' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Blog Sources
                    </button>
                    <button 
                        onClick={() => setActiveTab('quotes')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'quotes' ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Custom Quotes
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">

                    {activeTab === 'connection' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <h3 className="text-indigo-300 font-semibold mb-2">Gemini API Key</h3>
                                <p className="text-slate-400 text-xs mb-4">
                                    To use the AI features (Smart Input, Reading Suggestions), you need a free API key from Google AI Studio.
                                </p>
                                
                                <div className="space-y-3">
                                    <div className="relative">
                                        <input 
                                            type={showKey ? "text" : "password"}
                                            value={tempKey}
                                            onChange={(e) => setTempKey(e.target.value)}
                                            placeholder="Paste your API Key here"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                                        />
                                        <button 
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                        >
                                            {showKey ? 'Hide' : 'Show'}
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleSaveKey}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {apiKey === tempKey && apiKey ? "Saved" : "Save Key"}
                                        </button>
                                        {apiKey && (
                                            <button 
                                                onClick={handleRemoveKey}
                                                className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-center">
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                                >
                                    Get a free API key here &rarr;
                                </a>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'blogs' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Add websites or domains for the Smart Reader to monitor. (e.g. <code>karpathy.github.io</code>)
                            </p>
                            
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newBlog}
                                    onChange={(e) => setNewBlog(e.target.value)}
                                    placeholder="Enter domain..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBlog()}
                                />
                                <button 
                                    onClick={handleAddBlog}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Add
                                </button>
                            </div>

                            <div className="space-y-2 mt-4">
                                {blogSources.map((blog, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50 group">
                                        <span className="text-slate-300 text-sm truncate">{blog}</span>
                                        <button 
                                            onClick={() => removeBlog(idx)}
                                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {blogSources.length === 0 && (
                                    <p className="text-center text-slate-600 text-xs py-4">No custom blogs. Using defaults.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'quotes' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Add your favorite quotes. The Nudge widget will use these for inspiration.
                            </p>
                            
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newQuote}
                                    onChange={(e) => setNewQuote(e.target.value)}
                                    placeholder="Enter quote..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuote()}
                                />
                                <button 
                                    onClick={handleAddQuote}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Add
                                </button>
                            </div>

                            <div className="space-y-2 mt-4">
                                {customQuotes.map((quote, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50 group">
                                        <span className="text-slate-300 text-sm italic truncate">"{quote}"</span>
                                        <button 
                                            onClick={() => removeQuote(idx)}
                                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {customQuotes.length === 0 && (
                                    <p className="text-center text-slate-600 text-xs py-4">No custom quotes.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};