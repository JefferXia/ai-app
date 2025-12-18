export interface Idea {
  id: string;
  title: string;
  description: string;
  type: 'standard' | 'contrarian' | 'niche';
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  purpose: string; // The "why" of this chapter
  valueScore: number; // 0-100, AI evaluated
}

export interface FavoriteItem {
  id: string;
  type: 'idea' | 'chapter_snippet' | 'structure';
  content: {
    title: string;
    description?: string;
    text?: string;
    outline?: Chapter[]; // Added for structure favorites
    templateName?: string; // Added for structure favorites
  };
  tags: string[];
  createdAt: number;
}

export interface BookProject {
  topic: string; // User initial input
  selectedIdea: Idea | null;
  elevatorPitch: string;
  templateType: 'manifesto' | 'os' | 'almanac' | 'storybrand' | 'blueocean' | 'atomic' | 'goldencircle' | 'hero' | 'jtbd' | null;
  outline: Chapter[];
  currentChapterId: string | null;
  favorites: FavoriteItem[];
  selectedModel?: string; // AI model used for this project
}

export type Step = 'forge' | 'structure' | 'writing' | 'packaging' | 'grimoire';

export interface AIResponse {
  text: string;
  error?: string;
}

export enum AnalysisType {
  FLUFF = 'FLUFF',
  LOGIC = 'LOGIC',
  BLOCK = 'BLOCK',
}
