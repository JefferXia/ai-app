/* ===== 问心移动端 · 主屏：上方历史流，中央一张纸，右下引路与归档 ===== */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  loadArchive,
  putEntry,
  loadDraft,
  saveDraft,
  isWelcomed,
  markWelcomed,
} from './db';
import { ensureAnonToken, isAnonRegistered, registerAnon } from './identity';
import { syncNow, fetchNudge } from './sync';
import { WELCOME_TEXT, type ArchiveEntry } from './types';

const C = {
  page: '#f6f1e7',
  ink: '#33302a',
  faint: '#a2947a',
  fainter: '#cfc4ae',
  line: '#c4b9a4',
  border: '#ddd3bf',
  pill: 'rgba(0,0,0,0.30)',
};

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fmtTime(t: number): string {
  const d = new Date(t);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(d, now)) return `今天 ${hm}`;
  if (sameDay(d, yesterday)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export default function WenxinScreen() {
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [nudge, setNudge] = useState<string[] | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const flowRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(0.35)).current;

  // 初始化：恢复草稿与归档；首访写入欢迎信；仅生成本地匿名身份
  // （注册推迟到用户主动点同步 / 点引路时，避免打开即产生空记录）
  useEffect(() => {
    (async () => {
      await ensureAnonToken();

      let list = loadArchive();
      if (list.length === 0 && !isWelcomed()) {
        const entry: ArchiveEntry = {
          id: genId(),
          t: Date.now(),
          text: WELCOME_TEXT,
        };
        putEntry(entry);
        markWelcomed();
        list = [entry];
      }
      setEntries(list);
      setDraft(loadDraft());
      setHydrated(true);
    })();
  }, []);

  // 草稿自动保存（防抖 300ms）
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => saveDraft(draft), 300);
    return () => clearTimeout(id);
  }, [draft, hydrated]);

  // 历史流初次停在最底部
  useEffect(() => {
    if (hydrated) {
      requestAnimationFrame(() =>
        flowRef.current?.scrollToEnd({ animated: false })
      );
    }
  }, [hydrated]);

  // 引路加载中的呼吸骨架
  useEffect(() => {
    if (!nudgeLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nudgeLoading, pulse]);

  const handleChange = (val: string) => {
    // 开始落笔，引路消散
    if (nudge) setNudge(null);
    setDraft(val);
  };

  const handleArchive = () => {
    const text = draft.trim();
    if (!text) return;
    const entry: ArchiveEntry = { id: genId(), t: Date.now(), text };
    putEntry(entry);
    setEntries((prev) => [...prev, entry]);
    setDraft('');
    saveDraft('');
    setNudge(null);
    requestAnimationFrame(() =>
      flowRef.current?.scrollToEnd({ animated: true })
    );
  };

  const handleSync = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    // 首次手动同步：用户主动点击，此时才注册匿名身份
    if (!(await isAnonRegistered())) {
      const registered = await registerAnon();
      if (!registered) {
        setSyncStatus('error');
        return;
      }
    }
    const result = await syncNow();
    if (result === 'ok') {
      setEntries(loadArchive());
      setSyncStatus('synced');
    } else {
      setSyncStatus('error');
    }
  };

  const handleNudge = async () => {
    if (nudgeLoading) return;
    setNudgeLoading(true);
    // 首次点引路：用户主动操作，此时才注册匿名身份（接口需要已注册身份）
    if (!(await isAnonRegistered())) {
      const registered = await registerAnon();
      if (!registered) {
        setNudgeLoading(false);
        return;
      }
    }
    const hints = await fetchNudge(draft);
    setNudgeLoading(false);
    setNudge(hints && hints.length ? hints : null);
  };

  const hasContent = draft.trim().length > 0;

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 顶栏：左 logo，右同步 */}
        <View style={styles.header}>
          <Text style={styles.logo}>心镜</Text>
          <Pressable
            onPress={handleSync}
            disabled={syncStatus === 'syncing'}
            style={styles.syncPill}
          >
            <Text style={styles.syncText}>
              {syncStatus === 'syncing'
                ? '同步中'
                : syncStatus === 'synced'
                  ? '已同步'
                  : syncStatus === 'error'
                    ? '同步失败 · 重试'
                    : '跨端同步'}
            </Text>
          </Pressable>
        </View>

        {/* 历史流：最新贴着纸 */}
        {entries.length > 0 && (
          <ScrollView
            ref={flowRef}
            style={styles.flow}
            contentContainerStyle={styles.flowContent}
            onContentSizeChange={() =>
              flowRef.current?.scrollToEnd({ animated: false })
            }
          >
            {entries.map((a) => (
              <View key={a.id} style={styles.entry}>
                <Text style={styles.entryTime}>{fmtTime(a.t)}</Text>
                <Text style={styles.entryText}>{a.text}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 纸 */}
        <View style={styles.paper}>
          <TextInput
            value={draft}
            onChangeText={handleChange}
            placeholder="此刻心里有什么，就写什么"
            placeholderTextColor={C.fainter}
            multiline
            style={styles.input}
          />

          {/* 引路区：左侧提示文字 / 骨架，右侧按钮 */}
          <View style={styles.actionRow}>
            <View style={styles.nudgeArea}>
              {nudgeLoading && !nudge && (
                <View style={styles.skeletonBox}>
                  <Animated.View
                    style={[styles.skeleton, { opacity: pulse, width: '66%' }]}
                  />
                  <Animated.View
                    style={[styles.skeleton, { opacity: pulse, width: '50%' }]}
                  />
                </View>
              )}
              {nudge && (
                <Text style={styles.nudgeText}>{nudge.join('\n')}</Text>
              )}
            </View>

            <View style={styles.buttons}>
              {/* 引路：卡住时点一下（移动端提示常驻） */}
              <View style={styles.bulbWrap}>
                <Text style={styles.bulbTip}>引路</Text>
                <Pressable
                  onPress={handleNudge}
                  disabled={nudgeLoading}
                  style={({ pressed }) => [
                    styles.bulb,
                    pressed && styles.pressed,
                    nudgeLoading && styles.disabled,
                  ]}
                  accessibilityLabel="引路"
                >
                  <Ionicons name="bulb-outline" size={16} color={C.faint} />
                </Pressable>
              </View>

              {hasContent && (
                <Pressable
                  onPress={handleArchive}
                  style={({ pressed }) => [
                    styles.archiveBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="archive-outline"
                    size={13}
                    color={C.faint}
                  />
                  <Text style={styles.archiveText}>归档</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: C.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: { fontSize: 14, letterSpacing: 6, color: '#6a5f4a' },
  syncPill: {
    backgroundColor: C.pill,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 2 },
  flow: { flexShrink: 1, maxHeight: '38%' },
  flowContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  entry: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: C.line,
    paddingLeft: 16,
    marginBottom: 28,
  },
  entryTime: {
    fontSize: 10,
    letterSpacing: 3,
    color: C.fainter,
    marginBottom: 8,
  },
  entryText: {
    fontSize: 15,
    lineHeight: 26,
    color: C.ink,
    opacity: 0.75,
  },
  paper: { flexShrink: 0, paddingHorizontal: 24, paddingVertical: 20 },
  input: {
    fontSize: 17,
    lineHeight: 30,
    color: C.ink,
    minHeight: 90,
    maxHeight: 220,
    textAlignVertical: 'top',
    padding: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    marginTop: 20,
  },
  nudgeArea: { flex: 1, minWidth: 0 },
  skeletonBox: { gap: 10, paddingTop: 4 },
  skeleton: {
    height: 13,
    borderRadius: 999,
    backgroundColor: '#e8dfcc',
  },
  nudgeText: {
    fontSize: 14,
    lineHeight: 24,
    fontStyle: 'italic',
    color: C.faint,
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulbWrap: { alignItems: 'center' },
  bulbTip: {
    fontSize: 9,
    letterSpacing: 2,
    color: C.fainter,
    marginBottom: 4,
  },
  bulb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  archiveText: { fontSize: 12, letterSpacing: 3, color: C.faint },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
