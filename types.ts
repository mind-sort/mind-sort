export enum Category {
  TODO = 'TODO',
  NOTE = 'NOTE',
  READ = 'READ',
  GOAL = 'GOAL'
}

export interface LinkPreviewData {
  url: string;
  title: string;
  siteName: string;
  description: string;
  imageUrl?: string;
}

export interface Item {
  id: string;
  text: string;
  category: Category;
  createdAt: number;
  completed: boolean;
  deadline?: number; // UNIX timestamp
  notifiedStages?: string[]; // Tracks which reminders have been sent: '24h', 'today', '1h', '15m'
  linkPreview?: LinkPreviewData | null; // null means checked and failed
}

export interface ClassificationResult {
  category: Category;
  refinedText: string;
  emoji: string;
  deadline?: string; // ISO String from API
}

export interface NudgeResult {
  message: string;
  type: 'motivation' | 'reminder' | 'wisdom';
}

export interface ReadingSuggestion {
  title: string;
  url: string;
  source: string;
  reason: string;
}