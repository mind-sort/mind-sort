import React, { useState, useEffect } from 'react';
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
        const newItems = items.map(item => {
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
                addNotification(message);
                return { ...item, notifiedStages: [...stages, stageKey] };
            }

            return item;
        });

        if (itemsChanged) {
            setItems(newItems);
        }
    };

    const timer = setInterval(checkReminders, 30000); // Check every 30s
    checkReminders(); // Run immediately

    return () => clearInterval(timer);
  }, [items]);

  const addNotification = (msg: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message: msg }]);
    // Auto dismiss
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  const handleAddItem = (newItem: Item) => {
    setItems(prev => [newItem, ...prev]);
  };

  const handleUpdateItem = (id: string, updates: Partial<Item>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleToggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const getItemsByCategory = (cat: Category) => items.filter(i => i.category === cat);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden flex flex-col">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-purple-500/5 rounded-full blur-[100px]"></div>
      </div>

      <header className="relative z-10 pt-8 pb-6 px-8 flex items-center justify-between max-w-[1600px] w-full mx-auto">
        <div className="w-10"></div> {/* Spacer for centering */}
        
        <div className="text-center">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-blue-100 to-indigo-200 tracking-tight mb-2">
            MindSort
            </h1>
            <p className="text-slate-500 text-sm font-medium tracking-widest uppercase">
            Focus • Organize • Achieve
            </p>
        </div>

        <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-500 transition-all text-slate-400 hover:text-white"
            title="Settings"
        >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
      </header>

      <main className="relative z-10 flex-1 flex flex-col max-w-[1600px] mx-auto w-full px-4 md:px-8 pb-8">
        
        {/* Input Section */}
        <SmartInput onAddItem={handleAddItem} />

        {/* Widgets Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full mb-12">
            <NudgeWidget items={items} customQuotes={customQuotes} />
            <ReadingWidget items={items} blogSources={blogSources} />
        </div>

        {/* Dashboard Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-0">
          
          <CategoryColumn 
            title="Todos" 
            category={Category.TODO}
            items={getItemsByCategory(Category.TODO)}
            icon="⚡"
            colorClass="text-amber-400 shadow-amber-900/20"
            onToggle={handleToggleItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
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
          />

          <CategoryColumn 
            title="Goals" 
            category={Category.GOAL}
            items={getItemsByCategory(Category.GOAL)}
            icon="🎯"
            colorClass="text-emerald-400 shadow-emerald-900/20"
            onToggle={handleToggleItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
          />

        </div>
      </main>
      
      <footer className="relative z-10 py-4 text-center text-slate-700 text-xs">
        <p>Powered by Gemini 2.5 Flash</p>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        blogSources={blogSources}
        setBlogSources={setBlogSources}
        customQuotes={customQuotes}
        setCustomQuotes={setCustomQuotes}
      />

      {/* Popup Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
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