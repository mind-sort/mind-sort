import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, ClassificationResult, NudgeResult, Item, ReadingSuggestion, LinkPreviewData } from "../types";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const modelId = "gemini-2.5-flash";

// --- Caches ---
const linkPreviewCache: Record<string, LinkPreviewData> = {};
let readingSuggestionCache: { data: ReadingSuggestion[], timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

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

const nudgeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: "The motivational quote or gentle reminder text.",
    },
    type: {
      type: Type.STRING,
      enum: ["motivation", "reminder", "wisdom"],
      description: "The type of nudge.",
    }
  },
  required: ["message", "type"],
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

export const classifyInput = async (input: string): Promise<ClassificationResult> => {
  if (!apiKey) return localClassify(input);

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
    console.warn("Gemini Classification failed (likely rate limit), using local fallback.");
    return localClassify(input);
  }
};

export const generateNudge = async (items: Item[], customQuotes: string[] = []): Promise<NudgeResult> => {
  if (!apiKey) {
      return fallbackNudge(customQuotes);
  }

  // Filter for context
  const pendingTodos = items.filter(i => i.category === Category.TODO && !i.completed).map(i => i.text);
  const goals = items.filter(i => i.category === Category.GOAL && !i.completed).map(i => i.text);

  let prompt = "";
  let userQuotesContext = "";
  
  if (customQuotes.length > 0) {
    userQuotesContext = `\nThe user has these favorite quotes: [${customQuotes.join(" | ")}]. You may strictly output one of these if it fits the context perfectly, or use them as style inspiration.`;
  }

  if (pendingTodos.length > 0) {
    prompt = `The user has these pending tasks: ${pendingTodos.slice(0, 5).join(", ")}. Give a gentle, motivating nudge or a short stoic reminder to focus. Keep it under 20 words.${userQuotesContext}`;
  } else if (goals.length > 0) {
    prompt = `The user is working towards these goals: ${goals.slice(0, 3).join(", ")}. Give a high-energy motivational quote related to persistence. Keep it under 20 words.${userQuotesContext}`;
  } else {
    prompt = `The user has a clear list. Give a short, zen quote about clarity of mind or resting.${userQuotesContext}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: nudgeSchema,
        temperature: 1.0, 
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as NudgeResult;
  } catch (error) {
    return fallbackNudge(customQuotes);
  }
};

const fallbackNudge = (customQuotes: string[]): NudgeResult => {
    if (customQuotes.length > 0) {
        return {
            message: customQuotes[Math.floor(Math.random() * customQuotes.length)],
            type: "motivation"
        };
    }
    const defaults = [
        "Focus on the step in front of you, not the whole staircase.",
        "Small progress is still progress.",
        "A clear mind is a powerful mind."
    ];
    return {
        message: defaults[Math.floor(Math.random() * defaults.length)],
        type: "wisdom"
    };
};

export const getReadingSuggestion = async (userReadItems: string[], customDomains: string[] = []): Promise<ReadingSuggestion[]> => {
  // Check Cache
  if (readingSuggestionCache && (Date.now() - readingSuggestionCache.timestamp < CACHE_TTL)) {
      return readingSuggestionCache.data;
  }

  if (!apiKey) return getFallbackSuggestions();

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
    I need 3 technical reading recommendations.
    
    Step 1: Use Google Search to find recent/interesting blog posts from: ${targetDomains.join(", ")}. Query: '${searchQuery}'.
    Step 2: Select 3 distinct articles.
    
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
    // Clean code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let items: ReadingSuggestion[] = [];
    try {
        items = JSON.parse(cleanText);
    } catch (e) {
        // Simple manual parse fallback if JSON fails
        console.warn("JSON parse failed for reading list, returning fallback");
        return getFallbackSuggestions();
    }

    if (!Array.isArray(items) || items.length === 0) {
        return getFallbackSuggestions();
    }
    
    // Ensure we have 3 items
    const validItems = items.slice(0, 3).map(i => ({
        title: i.title || "Interesting Read",
        url: i.url || "#",
        source: i.source || "Web",
        reason: i.reason || "Recommended"
    }));

    // Update Cache
    readingSuggestionCache = {
        data: validItems,
        timestamp: Date.now()
    };

    return validItems;

  } catch (error) {
    console.warn("Reading Suggestion API failed", error);
    return getFallbackSuggestions();
  }
};

const getFallbackSuggestions = (): ReadingSuggestion[] => {
    return [
        {
            title: "The Unreasonable Effectiveness of Recurrent Neural Networks",
            url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
            source: "Karpathy Blog",
            reason: "A classic essential read."
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
            reason: "Learn how to communicate with AI."
        }
    ];
};

export const getLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
    if (linkPreviewCache[url]) {
        return linkPreviewCache[url];
    }

    if (!apiKey) return null;

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

        // Cache it
        linkPreviewCache[url] = preview;
        return preview;
    } catch (e) {
        // Fallback to basic object on error
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