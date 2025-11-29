import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, ClassificationResult, NudgeResult, Item, ReadingSuggestion, LinkPreviewData } from "../types";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const modelId = "gemini-2.5-flash";

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

// --- Functions ---

export const classifyInput = async (input: string): Promise<ClassificationResult> => {
  if (!apiKey) throw new Error("API Key missing");

  const now = new Date();
  const timeContext = `Current Date/Time: ${now.toLocaleString()} (ISO: ${now.toISOString()}). Weekday: ${now.toLocaleDateString('en-US', { weekday: 'long' })}.`;

  const prompt = `
    Analyze the following user input and categorize it.
    ${timeContext}
    Input: "${input}"
    
    Rules:
    - TODO: Actionable tasks, errands, reminders, items to buy ro shop.
      * IMPORTANT: If a time or date is mentioned (e.g. "tomorrow at 5pm", "in 2 hours", "next friday"), extract it into the 'deadline' field as a valid ISO 8601 string.
    - NOTE: Random thoughts, ideas, observations, reference info, movies, songs etc
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
    console.error("Classification error:", error);
    // Fallback if AI fails
    return {
      category: Category.NOTE,
      refinedText: input,
      emoji: "📝"
    };
  }
};

export const generateNudge = async (items: Item[], customQuotes: string[] = []): Promise<NudgeResult> => {
  if (!apiKey) throw new Error("API Key missing");

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
    // If AI fails and we have local quotes, use one
    if (customQuotes.length > 0) {
        return {
            message: customQuotes[Math.floor(Math.random() * customQuotes.length)],
            type: "motivation"
        };
    }
    return {
      message: "Focus on the present moment.",
      type: "wisdom"
    };
  }
};

export const getReadingSuggestion = async (userReadItems: string[], customDomains: string[] = []): Promise<ReadingSuggestion> => {
  if (!apiKey) throw new Error("API Key missing");

  const defaultDomains = [
    "karpathy.github.io",
    "lilianweng.github.io",
    "openai.com/news",
    "research.google/blog",
    "anthropic.com/news",
    "github.blog"
  ];

  const targetDomains = customDomains.length > 0 ? customDomains : defaultDomains;
  
  // Construct a specific search query for recent posts from these sites
  // Limit to top 10 domains to prevent query explosion if user adds too many
  const siteQuery = targetDomains.slice(0, 10).map(d => `site:${d.replace(/^https?:\/\//, '')}`).join(" OR ");
  const searchQuery = `(${siteQuery}) "latest blog post" AI machine learning technology`;

  const userContext = userReadItems.length > 0 
    ? `Or choose one from my reading list: "${userReadItems.slice(0, 5).join('", "')}"`
    : "";

  const prompt = `
    I need a technical reading recommendation. 
    
    Step 1: Use Google Search to find the most recent/interesting blog post from these domains: ${targetDomains.join(", ")}. Use the query: '${searchQuery}'.
    Step 2: ${userContext}
    Step 3: Select the BEST single article. Prioritize fresh content (2024-2025) from the blogs.
    
    Output the result in this block format:
    TITLE: [Insert Title Here]
    URL: [Insert Direct Link Here]
    SOURCE: [Insert Source Name]
    REASON: [Insert short reason]
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
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as any[];

    // Parsing
    let title = text.match(/TITLE:\s*(.+)/i)?.[1]?.trim();
    let url = text.match(/URL:\s*(.+)/i)?.[1]?.trim();
    let source = text.match(/SOURCE:\s*(.+)/i)?.[1]?.trim();
    let reason = text.match(/REASON:\s*(.+)/i)?.[1]?.trim();

    // Intelligent URL Recovery
    
    let foundGroundedUrl = false;

    if (chunks && chunks.length > 0) {
        // 1. Try to find a chunk that exactly matches the text URL if provided
        if (url && chunks.some(c => c.web?.uri === url)) {
            foundGroundedUrl = true;
        } 
        
        // 2. If no exact match or no URL text, look for a chunk with a matching title
        if (!foundGroundedUrl && title) {
            const titleMatch = chunks.find(c => c.web?.title && (c.web.title.includes(title) || title.includes(c.web.title)));
            if (titleMatch?.web?.uri) {
                url = titleMatch.web.uri;
                foundGroundedUrl = true;
            }
        }

        // 3. If still nothing, look for a chunk from our trusted domains
        if (!foundGroundedUrl) {
            const domainMatch = chunks.find(c => targetDomains.some(d => c.web?.uri?.includes(d.replace('https://','').replace('http://','').replace('/news','').replace('/blog',''))));
            if (domainMatch?.web?.uri) {
                url = domainMatch.web.uri;
                title = domainMatch.web.title || title || "Recommended Article";
                foundGroundedUrl = true;
            }
        }
    }

    // Default Fallback if everything fails
    if (!url || !url.startsWith("http")) {
         return {
            title: "The Unreasonable Effectiveness of Recurrent Neural Networks",
            url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
            source: "Karpathy Blog (Fallback)",
            reason: "AI couldn't verify a new link, but this is a classic."
        };
    }

    return {
      title: title || "Interesting Article",
      url: url,
      source: source || "Web",
      reason: reason || "Recommended for you."
    };

  } catch (error) {
    console.error(error);
    return {
      title: "The Unreasonable Effectiveness of Recurrent Neural Networks",
      url: "https://karpathy.github.io/2015/05/21/rnn-effectiveness/",
      source: "Karpathy Blog",
      reason: "Fallback recommendation."
    };
  }
};

export const getLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
    if (!apiKey) return null;

    const prompt = `
        Visit this URL and provide metadata: ${url}
        
        Return a valid JSON object with the following keys:
        - title: The page title
        - siteName: The website name (e.g. GitHub, CNN)
        - description: A short summary of the page (max 15 words)
        
        Do not use markdown code blocks. Just return the raw JSON string.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                // responseMimeType and responseSchema are not supported with tools in the current API version
                tools: [{ googleSearch: {} }] 
            }
        });

        let text = response.text;
        if (!text) return null;
        
        // Sanitize response to ensure valid JSON
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const data = JSON.parse(text);
        return {
            url,
            title: data.title || "No Title",
            siteName: data.siteName || "Website",
            description: data.description || "No description available"
        };
    } catch (e) {
        console.error("Link unfurling failed", e);
        return null;
    }
}
