import { AnalysisType } from './types';

const API_BASE = '/api/inkalchemy';

export const generateBrainstormIdeas = async (topic: string, round: 1 | 2 | 3, existingIdeas: string[] = [], model?: string) => {
  const response = await fetch(`${API_BASE}/brainstorm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, round, existingIdeas, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateElevatorPitch = async (idea: string, model?: string) => {
  const response = await fetch(`${API_BASE}/pitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const recommendTemplate = async (topic: string, ideaType: string, pitch: string, model?: string) => {
  const response = await fetch(`${API_BASE}/recommend-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, ideaType, pitch, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateOutline = async (title: string, pitch: string, template: string, model?: string) => {
  const response = await fetch(`${API_BASE}/outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, pitch, template, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const analyzeContent = async (text: string, type: 'FLUFF' | 'LOGIC' | 'BLOCK', model?: string) => {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateMarketingAssets = async (title: string, chapterContent: string, model?: string) => {
  const response = await fetch(`${API_BASE}/marketing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, chapterContent, model }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};
