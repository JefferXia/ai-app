/**
 * Aura State Machine Hook
 * 将状态机集成到 React 组件
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import {
  AuraStateMachine,
  IntentVector,
  ResponseStrategy,
  SILENCE_THRESHOLDS,
  AuraState,
} from '@/lib/aura-state-machine';

interface UseAuraStateMachineOptions {
  onProactiveMessage?: (intentVector: IntentVector, strategy: ResponseStrategy) => void;
  onEnterGuardMode?: () => void;
  onEnterSleepMode?: () => void;
  onOpenRadio?: () => void;
  onStateChange?: (state: AuraState) => void;
}

export function useAuraStateMachine(options: UseAuraStateMachineOptions = {}) {
  const { onProactiveMessage, onEnterGuardMode, onEnterSleepMode, onOpenRadio, onStateChange } = options;

  // 状态机实例
  const stateMachineRef = useRef<AuraStateMachine | null>(null);

  // 检查定时器
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 当前状态（用于 UI 展示）
  const [currentState, setCurrentState] = useState<AuraState | null>(null);

  // 是否正在处理
  const isProcessingRef = useRef(false);

  // 用户是否正在输入
  const isTypingRef = useRef(false);

  // 使用 ref 存储回调，避免闭包问题
  const onProactiveMessageRef = useRef(onProactiveMessage);
  const onEnterGuardModeRef = useRef(onEnterGuardMode);
  const onEnterSleepModeRef = useRef(onEnterSleepMode);
  const onOpenRadioRef = useRef(onOpenRadio);
  const onStateChangeRef = useRef(onStateChange);

  // 更新回调 refs
  useEffect(() => {
    onProactiveMessageRef.current = onProactiveMessage;
    onEnterGuardModeRef.current = onEnterGuardMode;
    onEnterSleepModeRef.current = onEnterSleepMode;
    onOpenRadioRef.current = onOpenRadio;
    onStateChangeRef.current = onStateChange;
  }, [onProactiveMessage, onEnterGuardMode, onEnterSleepMode, onOpenRadio, onStateChange]);

  // 初始化状态机
  useEffect(() => {
    if (!stateMachineRef.current) {
      stateMachineRef.current = new AuraStateMachine();

      // 设置状态变更回调
      stateMachineRef.current.setOnStateChange((state) => {
        setCurrentState(state);
        onStateChangeRef.current?.(state);
      });

      setCurrentState(stateMachineRef.current.getState());
    }

    return () => {
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
      }
    };
  }, []);

  /**
   * 开始静默检查
   */
  const startSilenceCheck = useCallback(() => {
    // 清除之前的定时器
    if (checkTimerRef.current) {
      clearInterval(checkTimerRef.current);
    }

    console.log('[AuraStateMachine] 开始静默检查，设置 5 秒定时器');

    // 每 5 秒检查一次静默状态
    checkTimerRef.current = setInterval(() => {
      console.log('[AuraStateMachine] 定时器触发，检查静默状态', {
        isProcessing: isProcessingRef.current,
        isTyping: isTypingRef.current,
      });

      if (isProcessingRef.current || isTypingRef.current) {
        console.log('[AuraStateMachine] 跳过检查：正在处理或输入中');
        return;
      }

      const stateMachine = stateMachineRef.current;
      if (!stateMachine) {
        console.log('[AuraStateMachine] 跳过检查：状态机不存在');
        return;
      }

      const { shouldAct, intentVector } = stateMachine.checkSilence();
      console.log('[AuraStateMachine] checkSilence 结果:', { shouldAct, intentVector });

      if (shouldAct) {
        const strategy = stateMachine.getResponseStrategy(intentVector);
        console.log('[AuraStateMachine] 触发主动消息，策略:', strategy);

        // 如果要打开电台（不计入主动对话计数）
        if (strategy.openRadio) {
          console.log('[AuraStateMachine] 打开电台，停止静默检查');
          // 停止静默检查定时器
          if (checkTimerRef.current) {
            clearInterval(checkTimerRef.current);
            checkTimerRef.current = null;
          }
          onOpenRadioRef.current?.();
          return;
        }

        // 如果要进入睡眠模式（不计入主动对话计数）
        if (strategy.enterSleepMode) {
          console.log('[AuraStateMachine] 进入睡眠模式，停止静默检查');
          // 停止静默检查定时器
          if (checkTimerRef.current) {
            clearInterval(checkTimerRef.current);
            checkTimerRef.current = null;
          }
          onEnterSleepModeRef.current?.();
          return;
        }

        // 如果进入守护模式（不计入主动对话计数，只是状态变化）
        if (intentVector.action === 'ENTER_GUARD') {
          onEnterGuardModeRef.current?.();
          return;
        }

        // 只有实际发送主动消息时才增加计数器
        stateMachine.incrementProactiveCounter();

        // 触发主动消息
        onProactiveMessageRef.current?.(intentVector, strategy);
      }
    }, 5000);

    console.log('[AuraStateMachine] 定时器已设置:', checkTimerRef.current);
  }, []); // 移除依赖，使用 ref 避免闭包问题

  /**
   * 停止静默检查
   */
  const stopSilenceCheck = useCallback(() => {
    if (checkTimerRef.current) {
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = null;
    }
  }, []);

  /**
   * 处理用户输入
   */
  const handleUserInput = useCallback((message: string): IntentVector => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) {
      return {
        intent: 'none',
        anxietyLevel: 0,
        action: 'RESPOND',
      };
    }

    // 停止静默检查
    stopSilenceCheck();

    // 处理用户输入
    const intentVector = stateMachine.handleUserInput(message);

    return intentVector;
  }, [stopSilenceCheck]);

  /**
   * 处理 AI 响应
   */
  const handleAIResponse = useCallback((response: string) => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) return;

    // 记录 AI 响应
    stateMachine.handleAIResponse(response);

    // 重新开始静默检查
    startSilenceCheck();
  }, [startSilenceCheck]);

  /**
   * 获取回复策略
   */
  const getResponseStrategy = useCallback((intentVector: IntentVector): ResponseStrategy => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) {
      return {
        type: 'respond',
        tone: 'empathetic',
        promptHint: '',
        shouldSpeak: true,
      };
    }
    return stateMachine.getResponseStrategy(intentVector);
  }, []);

  /**
   * 设置处理状态
   */
  const setIsProcessing = useCallback((processing: boolean) => {
    isProcessingRef.current = processing;
  }, []);

  /**
   * 设置输入状态
   */
  const setIsTyping = useCallback((typing: boolean) => {
    isTypingRef.current = typing;
  }, []);

  /**
   * 获取当前状态
   */
  const getState = useCallback((): AuraState | null => {
    return stateMachineRef.current?.getState() || null;
  }, []);

  /**
   * 增加主动对话计数器
   */
  const incrementProactiveCounter = useCallback(() => {
    stateMachineRef.current?.incrementProactiveCounter();
  }, []);

  /**
   * 用户唤醒（从睡眠模式）
   */
  const wakeUp = useCallback(() => {
    stateMachineRef.current?.wakeUp();
  }, []);

  return {
    // 状态
    currentState,

    // 操作
    handleUserInput,
    handleAIResponse,
    getResponseStrategy,
    startSilenceCheck,
    stopSilenceCheck,
    incrementProactiveCounter,
    wakeUp,

    // 状态设置
    setIsProcessing,
    setIsTyping,
    getState,

    // 常量
    SILENCE_THRESHOLDS,
  };
}