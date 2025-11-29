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

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>(loadItems);
  const [blogSources, setBlogSources] = useState<string[]>(loadBlogs);
  const [customQuotes, setCustomQuotes] = useState<string[]>(loadQuotes);
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

                // Logic: 
                // 1. Day before (24h - 25h range or just < 24h once)
                // 2. On the day (Check if dates match and not sent 'today')
                // 3. 1 hour before (< 60m)
                // 4. 15 min before (< 15m)

                const deadlineDate = new Date(item.deadline);
                const nowDate = new Date();
                const isSameDay = deadlineDate.toDateString() === nowDate.toDateString();
                const hoursLeft = diff / (1000 * 60 * 60);
                const minutesLeft = diff / (1000 * 60);

                if (diff > 0) {
                    // 15 min warning
                    if (minutesLeft <= 15 && !stages.includes('15m')) {
                        shouldNotify = true;
                        message = `⏰ Due in 15 mins: ${item.text}`;
                        stageKey = '15m';
                    }
                    // 1 hour warning
                    else if (minutesLeft > 15 && hoursLeft <= 1 && !stages.includes('1h')) {
                        shouldNotify = true;
                        message = `⚠️ Due in 1 hour: ${item.text}`;
                        stageKey = '1h';
                    }
                    // Same day warning
                    else if (isSameDay && !stages.includes('today') && hoursLeft > 1) {
                        shouldNotify = true;
                        message = `📅 Due today: ${item.text}`;
                        stageKey = 'today';
                    }
                    // Day before warning (approx 24h)
                    else if (!isSameDay && hoursLeft <= 24 && !stages.includes('24h')) {
                        shouldNotify = true;
                        message = `📅 Due tomorrow: ${item.text}`;
                        stageKey = '24h';
                    }
                }

                if (shouldNotify) {
                    itemsChanged = true;
                    // Trigger notification side effect outside the map if possible, 
                    // but calling setState inside setState callback is risky.
                    // We'll queue it.
                    setTimeout(() => addNotification(message), 0);
                    return { ...item, notifiedStages: [...stages, stageKey] };
                }

                return item;
            });
            return itemsChanged ? newItems : currentItems;
        });
    };

    const timer = setInterval(checkReminders, 30000); // Check every 30s
    checkReminders(); // Run immediately

    return () => clearInterval(timer);
  }, []); // Removed dependency on items, using functional state update

  const addNotification = (msg: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message: msg }]);
    // Auto dismiss
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

  const getItemsByCategory = (cat: Category) => items.filter(i => i.category === cat);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0f172a] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden flex flex-col font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-purple-500/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Header - Fixed Top */}
      <header className="flex-none relative z-30 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
            <div className="w-10"></div> {/* Spacer for centering */}
            
            <div className="text-center">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-blue-100 to-indigo-200 tracking-tight">
                MindSort
                </h1>
            </div>

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-500 transition-all text-slate-400 hover:text-white"
                title="Settings"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
      </header>

      {/* Main Content - Flex Column for Screen Fitting */}
      <main className="flex-1 flex flex-col relative z-10 w-full max-w-[1600px] mx-auto overflow-hidden p-4 pt-6 gap-6">
        
        {/* Nudge Widget - Text Only */}
        <div className="flex-none">
             <NudgeWidget items={items} customQuotes={customQuotes} />
        </div>

        {/* Goal and Smart Reader Row - Compact Height & Reduced Width */}
        <div className="flex-none h-[220px] w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <ReadingWidget items={items} blogSources={blogSources} />
            </div>
        </div>

        {/* Main Lists Row - Fills remaining vertical space */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
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

      {/* Input Section - Fixed Bottom */}
      <div className="flex-none relative z-30 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/5 pt-4 pb-6 px-4 md:px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="max-w-[1600px] mx-auto w-full">
            <SmartInput onAddItem={handleAddItem} />
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        blogSources={blogSources}
        setBlogSources={setBlogSources}
        customQuotes={customQuotes}
        setCustomQuotes={setCustomQuotes}
      />

      {/* Notifications */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
            <div key={n.id} className="animate-[slideIn_0.3s_ease-out] bg-slate-800/90 backdrop-blur-md border border-slate-600 text-slate-100 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm pointer-events-auto">
                <span className="text-xl">🔔</span>
                <p className="text-sm font-medium">{n.message}</p>
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