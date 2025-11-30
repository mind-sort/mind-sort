import React, { useState, useEffect, useCallback } from 'react';
import { SmartInput } from './components/SmartInput';
import { CategoryColumn } from './components/CategoryColumn';
import { NudgeWidget } from './components/NudgeWidget';
import { ReadingWidget } from './components/ReadingWidget';
import { SettingsModal } from './components/SettingsModal';
import { Item, Category } from './types';

// Initial state loader for items
const loadItems = (): Item[] => {
  try {
    const saved = localStorage.getItem('mindsort_items');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

// Initial state loader for blogs
const loadBlogs = (): string[] => {
    try {
        const saved = localStorage.getItem('mindsort_blogs');
        return saved ? JSON.parse(saved) : [
            "karpathy.github.io",
            "lilianweng.github.io",
            "openai.com/news",
            "research.google/blog",
            "anthropic.com/news",
            "github.blog"
        ];
    } catch (e) {
        return [];
    }
};

// Initial state loader for quotes
const loadQuotes = (): string[] => {
    try {
        const saved = localStorage.getItem('mindsort_quotes');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

// Initial state loader for read history
const loadReadHistory = (): string[] => {
    try {
        const saved = localStorage.getItem('mindsort_read_history');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

// Initial state loader for API Key
const loadApiKey = (): string => {
    return localStorage.getItem('mindsort_api_key') || '';
};

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>(loadItems);
  const [blogSources, setBlogSources] = useState<string[]>(loadBlogs);
  const [customQuotes, setCustomQuotes] = useState<string[]>(loadQuotes);
  const [readHistory, setReadHistory] = useState<string[]>(loadReadHistory);
  const [apiKey, setApiKey] = useState<string>(loadApiKey);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('mindsort_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('mindsort_blogs', JSON.stringify(blogSources));
  }, [blogSources]);

  useEffect(() => {
    localStorage.setItem('mindsort_quotes', JSON.stringify(customQuotes));
  }, [customQuotes]);

  useEffect(() => {
    localStorage.setItem('mindsort_read_history', JSON.stringify(readHistory));
  }, [readHistory]);

  useEffect(() => {
    localStorage.setItem('mindsort_api_key', apiKey);
  }, [apiKey]);

  // Reminder Logic
  useEffect(() => {
    const checkReminders = () => {
        const now = Date.now();
        let itemsChanged = false;
        
        // Use a functional update to avoid dependency on 'items' causing infinite loop if we modify it
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.completed || !item.deadline) return item;

                const diff = item.deadline - now;
                const stages = item.notifiedStages || [];
                let shouldNotify = false;
                let message = "";
                let stageKey = "";

                const deadlineDate = new Date(item.deadline);
                const nowDate = new Date();
                const isSameDay = deadlineDate.toDateString() === nowDate.toDateString();
                const hoursLeft = diff / (1000 * 60 * 60);
                const minutesLeft = diff / (1000 * 60);

                if (diff > 0) {
                    if (minutesLeft <= 15 && !stages.includes('15m')) {
                        shouldNotify = true;
                        message = `⏰ Due in 15 mins: ${item.text}`;
                        stageKey = '15m';
                    }
                    else if (minutesLeft > 15 && hoursLeft <= 1 && !stages.includes('1h')) {
                        shouldNotify = true;
                        message = `⚠️ Due in 1 hour: ${item.text}`;
                        stageKey = '1h';
                    }
                    else if (isSameDay && !stages.includes('today') && hoursLeft > 1) {
                        shouldNotify = true;
                        message = `📅 Due today: ${item.text}`;
                        stageKey = 'today';
                    }
                    else if (!isSameDay && hoursLeft <= 24 && !stages.includes('24h')) {
                        shouldNotify = true;
                        message = `📅 Due tomorrow: ${item.text}`;
                        stageKey = '24h';
                    }
                }

                if (shouldNotify) {
                    itemsChanged = true;
                    setTimeout(() => addNotification(message), 0);
                    return { ...item, notifiedStages: [...stages, stageKey] };
                }

                return item;
            });
            return itemsChanged ? newItems : currentItems;
        });
    };

    const timer = setInterval(checkReminders, 30000); 
    checkReminders(); 

    return () => clearInterval(timer);
  }, []); 

  const addNotification = (msg: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message: msg }]);
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  const handleAddItem = useCallback((newItem: Item) => {
    setItems(prev => [newItem, ...prev]);
  }, []);

  const handleUpdateItem = useCallback((id: string, updates: Partial<Item>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const handleToggleItem = useCallback((id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleMoveItem = useCallback((id: string, newCategory: Category) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, category: newCategory } : item
    ));
  }, []);

  const handleMarkRead = useCallback((url: string) => {
    setReadHistory(prev => [...prev, url]);
  }, []);

  const handleRequestApiKey = useCallback(() => {
    addNotification("Please setup your Gemini API Key first.");
    setIsSettingsOpen(true);
  }, []);

  const handleApiError = useCallback((errorType: string) => {
    if (errorType === "AUTH_ERROR") {
        addNotification("API Key Invalid. Please check settings.");
    } else if (errorType === "QUOTA_ERROR") {
        addNotification("API Quota Exceeded.");
    }
    setIsSettingsOpen(true);
  }, []);

  const getItemsByCategory = (cat: Category) => items.filter(i => i.category === cat);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0f172a] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden flex flex-col font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-purple-500/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Header - Fixed Top - Compact Height */}
      <header className="flex-none relative z-30 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 h-12 flex items-center">
        <div className="max-w-[1600px] w-full mx-auto px-4 flex items-center justify-between">
            <div className="w-8"></div>
            
            <div className="text-center">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-blue-100 to-indigo-200 tracking-tight">
                MindSort
                </h1>
            </div>

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-1.5 rounded-full border transition-all ${!apiKey ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 hover:bg-amber-500/20' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white'}`}
                title="Settings"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
      </header>

      {/* Main Content - Compact flex column */}
      <main className="flex-1 flex flex-col relative z-10 w-full max-w-[1600px] mx-auto overflow-hidden px-4 pt-2 pb-1 gap-2">
        
        {/* Nudge Widget - Ultra Compact */}
        <div className="flex-none min-h-0">
             <NudgeWidget items={items} customQuotes={customQuotes} />
        </div>

        {/* Goal and Smart Reader Row - Very Compact Height */}
        <div className="flex-none h-[200px] w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-full min-h-0">
                <CategoryColumn 
                    title="Goals" 
                    category={Category.GOAL}
                    items={getItemsByCategory(Category.GOAL)}
                    icon="🎯"
                    colorClass="text-emerald-400 shadow-emerald-900/20"
                    onToggle={handleToggleItem}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                    onMoveItem={handleMoveItem}
                />
            </div>
            <div className="h-full min-h-0">
                <ReadingWidget 
                    items={items} 
                    blogSources={blogSources} 
                    readHistory={readHistory}
                    onMarkRead={handleMarkRead}
                    apiKey={apiKey}
                />
            </div>
        </div>

        {/* Main Lists Row - Fills remaining space, dense grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-3 pb-1">
          <CategoryColumn 
            title="Todos" 
            category={Category.TODO}
            items={getItemsByCategory(Category.TODO)}
            icon="⚡"
            colorClass="text-amber-400 shadow-amber-900/20"
            onToggle={handleToggleItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
            onMoveItem={handleMoveItem}
          />

          <CategoryColumn 
            title="Reading List" 
            category={Category.READ}
            items={getItemsByCategory(Category.READ)}
            icon="📚"
            colorClass="text-blue-400 shadow-blue-900/20"
            onToggle={handleToggleItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
            onMoveItem={handleMoveItem}
          />

          <CategoryColumn 
            title="Notes" 
            category={Category.NOTE}
            items={getItemsByCategory(Category.NOTE)}
            icon="🧠"
            colorClass="text-purple-400 shadow-purple-900/20"
            onToggle={handleToggleItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
            onMoveItem={handleMoveItem}
          />
        </div>
      </main>

      {/* Input Section - Compact */}
      <div className="flex-none relative z-30 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/5 pt-3 pb-4 px-4 md:px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="max-w-[1600px] mx-auto w-full">
            <SmartInput 
                onAddItem={handleAddItem} 
                apiKey={apiKey}
                onRequestKey={handleRequestApiKey}
                onApiError={handleApiError}
            />
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        blogSources={blogSources}
        setBlogSources={setBlogSources}
        customQuotes={customQuotes}
        setCustomQuotes={setCustomQuotes}
        apiKey={apiKey}
        setApiKey={setApiKey}
      />

      {/* Notifications */}
      <div className="fixed top-16 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
            <div key={n.id} className="animate-[slideIn_0.3s_ease-out] bg-slate-800/90 backdrop-blur-md border border-slate-600 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-sm pointer-events-auto">
                <span className="text-lg">🔔</span>
                <p className="text-xs font-medium">{n.message}</p>
                <button 
                    onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                    className="ml-auto text-slate-500 hover:text-white"
                >
                    ✕
                </button>
            </div>
        ))}
      </div>
      
      <style>{`
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default App;