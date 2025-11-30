import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, ClassificationResult, NudgeResult, Item, ReadingSuggestion, LinkPreviewData } from "../types";

const modelId = "gemini-2.5-flash";

// --- Caches ---
const linkPreviewCache: Record<string, LinkPreviewData> = {};
const READING_CACHE_KEY = 'mindsort_reading_cache';
const READING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// --- Schemas ---

const classificationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: [Category.TODO, Category.NOTE, Category.READ, Category.GOAL],
      description: "The category the text belongs to.",
    },
    refinedText: {
      type: Type.STRING,
      description: "A clean, concise version of the input text (e.g., removing 'I need to', 'Make sure to').",
    },
    emoji: {
      type: Type.STRING,
      description: "A single relevant emoji representing the item.",
    },
    deadline: {
      type: Type.STRING,
      description: "ISO 8601 date string if a specific time/date is mentioned or implied (e.g., '2024-12-31T15:00:00'). Use the provided current time context to calculate relative dates like 'tomorrow' or 'next friday'. Return null if no date is found.",
      nullable: true
    }
  },
  required: ["category", "refinedText", "emoji"],
};

// --- Helpers ---

const handleError = (error: any) => {
    const msg = error.message || '';
    if (msg.includes('400') || msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
        throw new Error("AUTH_ERROR");
    }
    if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("QUOTA_ERROR");
    }
    throw error;
};

// --- Local Fallback Logic ---

const localClassify = (input: string): ClassificationResult => {
    const lower = input.toLowerCase();
    let category = Category.TODO;
    let emoji = "⚡";
    let deadline = undefined;

    // Basic Keyword Heuristics
    if (lower.includes("read ") || lower.includes("book") || lower.includes("article") || input.startsWith("http")) {
        category = Category.READ;
        emoji = "📚";
    } else if (lower.includes("goal") || lower.includes("achieve") || lower.includes("learn to")) {
        category = Category.GOAL;
        emoji = "🎯";
    } else if (lower.startsWith("note") || lower.includes("idea:") || lower.includes("remember")) {
        category = Category.NOTE;
        emoji = "📝";
    }

    // Basic Date Parsing Fallback
    const now = new Date();
    if (lower.includes("tomorrow")) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0); // Default to 9am
        deadline = d.toISOString();
    } else if (lower.includes("tonight")) {
        const d = new Date(now);
        d.setHours(20, 0, 0, 0);
        deadline = d.toISOString();
    }

    return {
        category,
        refinedText: input,
        emoji,
        deadline
    };
};

// --- Functions ---

export const classifyInput = async (input: string, apiKey: string): Promise<ClassificationResult> => {
  if (!apiKey) return localClassify(input);

  const ai = new GoogleGenAI({ apiKey });
  const now = new Date();
  const timeContext = `Current Date/Time: ${now.toLocaleString()} (ISO: ${now.toISOString()}). Weekday: ${now.toLocaleDateString('en-US', { weekday: 'long' })}.`;

  const prompt = `
    Analyze the following user input and categorize it.
    ${timeContext}
    Input: "${input}"
    
    Rules:
    - TODO: Actionable tasks, errands, reminders. 
      * IMPORTANT: If a time or date is mentioned (e.g. "tomorrow at 5pm", "in 2 hours", "next friday"), extract it into the 'deadline' field as a valid ISO 8601 string.
    - NOTE: Random thoughts, ideas, observations, reference info.
    - READ: Books, articles, blogs, papers to read.
    - GOAL: Long-term aspirations, habits, or big objectives.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: classificationSchema,
        temperature: 0.1, 
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as ClassificationResult;
  } catch (error) {
    handleError(error);
    return localClassify(input);
  }
};

export const generateNudge = async (items: Item[], customQuotes: string[] = []): Promise<NudgeResult> => {
    // Purely local random picker - no API calls
    const defaults = [
        "Focus on the step in front of you, not the whole staircase.",
        "Small progress is still progress.",
        "A clear mind is a powerful mind.",
        "Action is the antidote to despair.",
        "The best time to plant a tree was 20 years ago. The second best time is now.",
        "Simplicity is the ultimate sophistication.",
        "Do less, but better.",
        "Consistency is key.",
        "Don't watch the clock; do what it does. Keep going.",
        "Turn your wounds into wisdom.",
        "Every moment is a fresh beginning.",
        "What you do today can improve all your tomorrows."
    ];
  
    const pool = customQuotes.length > 0 ? [...defaults, ...customQuotes] : defaults;
    const message = pool[Math.floor(Math.random() * pool.length)];
  
    return {
        message,
        type: "wisdom"
    };
};

export const getReadingSuggestion = async (userReadItems: string[], customDomains: string[] = [], forceRefresh: boolean = false, apiKey: string): Promise<ReadingSuggestion[]> => {
  // 1. Retrieve Cache from Local Storage
  let cached: { timestamp: number, data: ReadingSuggestion[] } | null = null;
  const cachedRaw = localStorage.getItem(READING_CACHE_KEY);
  if (cachedRaw) {
      try { cached = JSON.parse(cachedRaw); } catch (e) {}
  }

  // 2. Return Cache if valid and not forced (Filter out read items)
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < READING_CACHE_TTL)) {
      const unreadCached = cached.data.filter(item => !userReadItems.includes(item.url));
      if (unreadCached.length > 0) {
        return unreadCached.slice(0, 3);
      }
  }

  // 3. Fallback logic if API key missing
  if (!apiKey) {
      if (cached) {
           const unreadExpired = cached.data.filter(item => !userReadItems.includes(item.url));
           if (unreadExpired.length > 0) return unreadExpired.slice(0, 3);
      }
      return getFallbackSuggestions(userReadItems);
  }

  const ai = new GoogleGenAI({ apiKey });

  const defaultDomains = [
    "karpathy.github.io",
    "lilianweng.github.io",
    "openai.com/news",
    "research.google/blog",
    "anthropic.com/news",
    "github.blog"
  ];

  const targetDomains = customDomains.length > 0 ? customDomains : defaultDomains;
  const siteQuery = targetDomains.slice(0, 10).map(d => `site:${d.replace(/^https?:\/\//, '')}`).join(" OR ");
  const searchQuery = `(${siteQuery}) "latest blog post" AI machine learning technology`;

  const prompt = `
    I need 5 technical reading recommendations.
    
    Step 1: Use Google Search to find recent/interesting blog posts from: ${targetDomains.join(", ")}. Query: '${searchQuery}'.
    Step 2: Select 5 distinct articles to ensure variety.
    
    Output a valid JSON array of objects. Do not use Markdown.
    [
      { "title": "...", "url": "...", "source": "...", "reason": "..." },
      ...
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let items: ReadingSuggestion[] = [];
    try {
        items = JSON.parse(cleanText);
    } catch (e) {
        console.warn("JSON parse failed for reading list");
    }

    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Invalid format or empty list");
    }
    
    const validItems = items.map(i => ({
        title: i.title || "Interesting Read",
        url: i.url || "#",
        source: i.source || "Web",
        reason: i.reason || "Recommended"
    }));

    // 4. Update Cache (Persistent)
    localStorage.setItem(READING_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: validItems
    }));

    return validItems.filter(i => !userReadItems.includes(i.url)).slice(0, 3);

  } catch (error) {
    handleError(error);
    // On Failure: Use cached data if available
    if (cached) {
        return cached.data.filter(i => !userReadItems.includes(i.url)).slice(0, 3);
    }
    return getFallbackSuggestions(userReadItems);
  }
};

const getFallbackSuggestions = (userReadItems: string[] = []): ReadingSuggestion[] => {
    const pool = [
        {
            title: "The Unreasonable Effectiveness of Recurrent Neural Networks",
            url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
            source: "Karpathy Blog",
            reason: "A classic essential read on RNNs."
        },
        {
            title: "Attention Is All You Need",
            url: "https://arxiv.org/abs/1706.03762",
            source: "ArXiv",
            reason: "The foundation of modern Transformers."
        },
        {
            title: "Prompt Engineering Guide",
            url: "https://www.promptingguide.ai/",
            source: "PromptingGuide",
            reason: "Learn how to communicate with AI effectively."
        },
        {
            title: "The Illustrated Transformer",
            url: "http://jalammar.github.io/illustrated-transformer/",
            source: "Jay Alammar",
            reason: "Best visual explanation of transformers."
        },
        {
            title: "OpenAI GPT-4 Technical Report",
            url: "https://arxiv.org/abs/2303.08774",
            source: "ArXiv",
            reason: "Deep dive into the architecture of GPT-4."
        },
        {
            title: "Distill.pub: A Gentle Introduction to Graph Neural Networks",
            url: "https://distill.pub/2021/gnn-intro/",
            source: "Distill",
            reason: "Interactive article on Graph Neural Networks."
        },
        {
            title: "Why AI Will Save the World",
            url: "https://a16z.com/why-ai-will-save-the-world/",
            source: "Marc Andreessen",
            reason: "An optimistic perspective on AI's future."
        }
    ];

    return pool
        .filter(i => !userReadItems.includes(i.url))
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
};

export const getLinkPreview = async (url: string, apiKey: string): Promise<LinkPreviewData | null> => {
    if (linkPreviewCache[url]) {
        return linkPreviewCache[url];
    }

    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
        Visit this URL and provide metadata: ${url}
        Return JSON object keys: title, siteName, description.
        No markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }] 
            }
        });

        let text = response.text;
        if (!text) return null;
        
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);
        
        const preview = {
            url,
            title: data.title || "No Title",
            siteName: data.siteName || new URL(url).hostname,
            description: data.description || ""
        };

        linkPreviewCache[url] = preview;
        return preview;
    } catch (e) {
        handleError(e);
        const fallback = {
            url,
            title: url,
            siteName: new URL(url).hostname,
            description: ""
        };
        linkPreviewCache[url] = fallback;
        return fallback;
    }
}