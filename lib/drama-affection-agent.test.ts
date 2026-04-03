import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAffectionStage,
  analyzeAffectionImpact,
  updateStoryMemory,
  getStageTransitionMessage,
  AFFECTION_STAGES,
  type StoryMemory,
  type AffectionAnalysis,
} from './drama-affection-agent';

// Mock the LLM call
vi.mock('./llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => ({
    content: JSON.stringify({
      delta: 3,
      reason: '温暖的问候',
    }),
    usage: { prompt_tokens: 10, completion_tokens: 20 },
    model: 'test-model',
  })),
}));

describe('drama-affection-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AFFECTION_STAGES', () => {
    it('should have correct stage thresholds', () => {
      expect(AFFECTION_STAGES.Initial).toEqual({ min: 0, max: 20, label: '初识' });
      expect(AFFECTION_STAGES.Acquaintance).toEqual({ min: 21, max: 40, label: '相识' });
      expect(AFFECTION_STAGES.Friend).toEqual({ min: 41, max: 60, label: '朋友' });
      expect(AFFECTION_STAGES.Close).toEqual({ min: 61, max: 80, label: '亲近' });
      expect(AFFECTION_STAGES.Intimate).toEqual({ min: 81, max: 100, label: '亲密' });
    });
  });

  describe('getAffectionStage', () => {
    it('should return Initial for affection 0-20', () => {
      expect(getAffectionStage(0)).toBe('Initial');
      expect(getAffectionStage(10)).toBe('Initial');
      expect(getAffectionStage(20)).toBe('Initial');
    });

    it('should return Acquaintance for affection 21-40', () => {
      expect(getAffectionStage(21)).toBe('Acquaintance');
      expect(getAffectionStage(30)).toBe('Acquaintance');
      expect(getAffectionStage(40)).toBe('Acquaintance');
    });

    it('should return Friend for affection 41-60', () => {
      expect(getAffectionStage(41)).toBe('Friend');
      expect(getAffectionStage(50)).toBe('Friend');
      expect(getAffectionStage(60)).toBe('Friend');
    });

    it('should return Close for affection 61-80', () => {
      expect(getAffectionStage(61)).toBe('Close');
      expect(getAffectionStage(70)).toBe('Close');
      expect(getAffectionStage(80)).toBe('Close');
    });

    it('should return Intimate for affection 81-100', () => {
      expect(getAffectionStage(81)).toBe('Intimate');
      expect(getAffectionStage(90)).toBe('Intimate');
      expect(getAffectionStage(100)).toBe('Intimate');
    });
  });

  describe('analyzeAffectionImpact', () => {
    it('should return valid analysis with LLM response', async () => {
      const result = await analyzeAffectionImpact(
        '早上好，陆总',
        'luze',
        20,
        {}
      );

      expect(result.delta).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.delta).toBeGreaterThanOrEqual(-10);
      expect(result.delta).toBeLessThanOrEqual(10);
    });

    it('should detect stage transition when crossing threshold', async () => {
      // Mock LLM to return +5 delta
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          delta: 5,
          reason: '真诚的关心',
        }),
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      // Use higher affection to avoid amplification
      const result = await analyzeAffectionImpact(
        '你看起来很累，要注意休息',
        'luze',
        45, // Near Friend stage, no amplification
        {}
      );

      // 45 + 5 = 50, stays in Friend stage
      expect(result.delta).toBe(5);
      expect(result.stageTransition).toBeUndefined();
    });

    it('should detect stage transition from Initial to Acquaintance', async () => {
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          delta: 3,
          reason: 'test',
        }),
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      // Use affection 50 to avoid amplification
      const result = await analyzeAffectionImpact(
        'test',
        'luze',
        50,
        {}
      );

      // 50 + 3 = 53, stays in Friend stage
      expect(result.delta).toBe(3);
      expect(result.stageTransition).toBeUndefined();
    });

    it('should clamp delta to valid range', async () => {
      // Mock LLM to return out-of-range delta
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          delta: 50, // Invalid, should be clamped to 10
          reason: 'test',
        }),
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      const result = await analyzeAffectionImpact('test', 'luze', 50, {});

      expect(result.delta).toBe(10);
    });

    it('should handle LLM failure gracefully', async () => {
      vi.mocked(await import('./llm')).callLLM.mockRejectedValueOnce(new Error('LLM failed'));

      const result = await analyzeAffectionImpact('test', 'luze', 50, {});

      expect(result.delta).toBe(0);
      expect(result.reason).toBe('无法分析');
    });

    it('should handle malformed JSON response', async () => {
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: 'not valid json',
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      const result = await analyzeAffectionImpact('test', 'luze', 50, {});

      expect(result.delta).toBe(0);
      expect(result.reason).toBe('无法分析');
    });

    it('should amplify negative delta for high affection', async () => {
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          delta: -5,
          reason: '冷淡的回应',
        }),
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      // High affection (70), negative should be amplified
      const result = await analyzeAffectionImpact('随便', 'luze', 70, {});

      // -5 * 1.2 = -6, floored to -6
      expect(result.delta).toBeLessThan(-5);
    });

    it('should amplify positive delta for low affection', async () => {
      vi.mocked(await import('./llm')).callLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          delta: 3,
          reason: '温暖的问候',
        }),
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        model: 'test-model',
      });

      // Low affection (20), positive should be amplified
      const result = await analyzeAffectionImpact('早上好', 'luze', 20, {});

      // 3 * 1.1 = 3.3, ceiled to 4
      expect(result.delta).toBeGreaterThan(3);
    });
  });

  describe('updateStoryMemory', () => {
    it('should add key plot point', () => {
      const currentMemory: StoryMemory = { keyPlotPoints: ['Initial meeting'] };
      const result = updateStoryMemory(currentMemory, {
        keyPlotPoint: 'User confessed feelings',
      });

      expect(result.keyPlotPoints).toContain('Initial meeting');
      expect(result.keyPlotPoints).toContain('User confessed feelings');
    });

    it('should add character decision', () => {
      const currentMemory: StoryMemory = { characterDecisions: [] };
      const result = updateStoryMemory(currentMemory, {
        characterDecision: 'Luze decided to trust',
      });

      expect(result.characterDecisions).toContain('Luze decided to trust');
    });

    it('should add established fact', () => {
      const currentMemory: StoryMemory = { establishedFacts: {} };
      const result = updateStoryMemory(currentMemory, {
        establishedFact: { key: 'userName', value: '苏小小' },
      });

      expect(result.establishedFacts?.userName).toBe('苏小小');
    });

    it('should limit keyPlotPoints to 20 items', () => {
      const existingPoints = Array.from({ length: 20 }, (_, i) => `Point ${i}`);
      const currentMemory: StoryMemory = { keyPlotPoints: existingPoints };
      const result = updateStoryMemory(currentMemory, {
        keyPlotPoint: 'New point',
      });

      expect(result.keyPlotPoints?.length).toBe(20);
      expect(result.keyPlotPoints).toContain('New point');
      expect(result.keyPlotPoints).not.toContain('Point 0');
    });

    it('should limit characterDecisions to 10 items', () => {
      const existingDecisions = Array.from({ length: 10 }, (_, i) => `Decision ${i}`);
      const currentMemory: StoryMemory = { characterDecisions: existingDecisions };
      const result = updateStoryMemory(currentMemory, {
        characterDecision: 'New decision',
      });

      expect(result.characterDecisions?.length).toBe(10);
      expect(result.characterDecisions).toContain('New decision');
      expect(result.characterDecisions).not.toContain('Decision 0');
    });

    it('should return unchanged memory if no update provided', () => {
      const currentMemory: StoryMemory = { keyPlotPoints: ['Test'] };
      const result = updateStoryMemory(currentMemory, undefined);

      expect(result).toEqual(currentMemory);
    });
  });

  describe('getStageTransitionMessage', () => {
    it('should return message for luze stages', () => {
      expect(getStageTransitionMessage('Initial', 'luze')).toContain('冷淡');
      expect(getStageTransitionMessage('Acquaintance', 'luze')).toContain('印象');
      expect(getStageTransitionMessage('Friend', 'luze')).toContain('软化');
      expect(getStageTransitionMessage('Close', 'luze')).toContain('温柔');
      expect(getStageTransitionMessage('Intimate', 'luze')).toContain('柔和');
    });

    it('should return empty string for unknown character', () => {
      expect(getStageTransitionMessage('Initial', 'unknown')).toBe('');
    });
  });
});