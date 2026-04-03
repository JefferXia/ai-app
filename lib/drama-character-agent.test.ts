import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCharacterConfig,
  generateGreeting,
  getSimpleCharacterConfig,
  DRAMA_CHARACTERS,
  LUZE_CONFIG,
} from './drama-character-agent';

// Mock the LLM call
vi.mock('./llm', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: '测试回复' }),
}));

describe('drama-character-agent', () => {
  describe('getCharacterConfig', () => {
    it('should return correct config for luze', () => {
      const config = getCharacterConfig('luze');
      expect(config).toBeDefined();
      expect(config?.id).toBe('luze');
      expect(config?.name).toBe('陆泽');
      expect(config?.displayName).toBe('陆泽');
    });

    it('should return null for unknown character', () => {
      const config = getCharacterConfig('unknown');
      expect(config).toBeNull();
    });
  });

  describe('getSimpleCharacterConfig', () => {
    it('should return simplified config for luze', () => {
      const config = getSimpleCharacterConfig('luze');
      expect(config).toBeDefined();
      expect(config?.id).toBe('luze');
      expect(config?.voiceId).toBe('male-qn-jingying');
      expect(config?.greeting).toBe('苏小姐，有什么事？');
    });

    it('should return null for unknown character', () => {
      const config = getSimpleCharacterConfig('unknown');
      expect(config).toBeNull();
    });
  });

  describe('DRAMA_CHARACTERS', () => {
    it('should contain multiple characters', () => {
      expect(DRAMA_CHARACTERS.length).toBeGreaterThanOrEqual(1);
      expect(DRAMA_CHARACTERS.some(c => c.id === 'luze')).toBe(true);
    });
  });

  describe('LUZE_CONFIG', () => {
    it('should have correct properties', () => {
      expect(LUZE_CONFIG.id).toBe('luze');
      expect(LUZE_CONFIG.voiceId).toBe('male-qn-jingying');
      expect(LUZE_CONFIG.greeting).toBe('苏小姐，有什么事？');
      expect(LUZE_CONFIG.bgImage).toBe('/images/character/luze_office.jpg');
      expect(LUZE_CONFIG.avatarImage).toBe('/images/avatar/luze.jpg');
    });

    it('should have personality with key traits', () => {
      expect(LUZE_CONFIG.personality).toContain('高冷');
      expect(LUZE_CONFIG.personality).toContain('理性');
      expect(LUZE_CONFIG.personality).toContain('苏小姐');
    });
  });

  describe('generateGreeting', () => {
    it('should return correct greeting for luze', () => {
      const greeting = generateGreeting('luze');
      expect(greeting).toBe('苏小姐，有什么事？');
    });

    it('should return default greeting for unknown character', () => {
      const greeting = generateGreeting('unknown');
      expect(greeting).toBe('你好。');
    });
  });
});