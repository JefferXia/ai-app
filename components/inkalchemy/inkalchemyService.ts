import { AnalysisType } from './types';

const API_BASE = '/api/inkalchemy';

export const generateBrainstormIdeas = async (topic: string, round: 1 | 2 | 3, existingIdeas: string[] = []) => {
  const response = await fetch(`${API_BASE}/brainstorm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, round, existingIdeas }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateElevatorPitch = async (idea: string) => {
  const response = await fetch(`${API_BASE}/pitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const recommendTemplate = async (topic: string, ideaType: string, pitch: string) => {
  const response = await fetch(`${API_BASE}/recommend-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, ideaType, pitch }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateOutline = async (title: string, pitch: string, template: string) => {
  const response = await fetch(`${API_BASE}/outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, pitch, template }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const analyzeContent = async (text: string, type: 'FLUFF' | 'LOGIC' | 'BLOCK') => {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

export const generateMarketingAssets = async (title: string, chapterContent: string) => {
  const response = await fetch(`${API_BASE}/marketing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, chapterContent }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};
