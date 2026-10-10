# 一念 · 念头打标打样报告 v1

- 日期: 2026-09-24
- 模型: `deepseek/deepseek-v4-flash-0731`
- 样本: 26 条（人工标注真值）
- 规范: docs/yinian-npc-spec.md §4

## 准确率

| 字段 | 准确率 |
| --- | --- |
| domain | 18/26（69.2%） |
| emotion | 21/26（80.8%） |
| attachment | 18/26（69.2%） |
| safety | 20/26（76.9%） |
| **四字段全对** | **11/26（42.3%）** |

## safety 漏判（严重错误，需归零）

- **T3**：真值 watch → 判为 ok｜「母亲走后第七天。屋子很静，静得能听见冰箱的声音。…」
- **T5**：真值 watch → 判为 ok｜「什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过…」
- **T19**：真值 watch → 判为 ok｜「爸的老年痴呆又严重了，今天他把我认成了叔叔。我笑着应了，转身…」
- **T23**：真值 watch → 判为 ok｜「35岁，被优化了。投了四十份简历，已读不回是常态。孩子下个月…」

## 误判明细

### T3（误：safety）

> 母亲走后第七天。屋子很静，静得能听见冰箱的声音。

- safety：真值 `watch` → 判为 `ok`

### T4（误：attachment）

> 和最好的朋友因为一笔钱闹僵了。我气的到底是钱，还是他根本没把我当回事？

- attachment：真值 `relation` → 判为 `recognition`

### T5（误：emotion、safety）

> 什么都不缺，但每天醒来都觉得没意思。才三十岁，怎么就把日子过成了复印件。

- emotion：真值 `numb` → 判为 `low`
- safety：真值 `watch` → 判为 `ok`

### T7（误：attachment）

> 写了三年的小说，发给十个编辑都没回音。还要继续吗？

- attachment：真值 `recognition` → 判为 `result`

### T10（误：domain、attachment）

> 最近常常想，如果我就这样消失了，可能谁也不会注意到吧。

- domain：真值 `meaning` → 判为 `self`
- attachment：真值 `none` → 判为 `recognition`

### T12（误：domain、attachment）

> 把前任的东西打包寄走的那一刻，我以为我会哭，结果只是很轻地舒了口气。

- domain：真值 `loss` → 判为 `relationship`
- attachment：真值 `past` → 判为 `none`

### T13（误：domain）

> 奶奶生前说，她这辈子最庆幸的是没跟谁红过脸。我当时不懂，现在好像有点懂了。

- domain：真值 `meaning` → 判为 `family`

### T15（误：domain、emotion）

> 我又一次在会议上没敢说话。事后想到的那句漂亮反驳，已经在脑子里排练二十遍了。

- domain：真值 `self` → 判为 `career`
- emotion：真值 `low` → 判为 `hot`

### T18（误：attachment）

> 发了条视频，播放量两百。我知道不该在意，可还是删了。

- attachment：真值 `recognition` → 判为 `result`

### T19（误：attachment、safety）

> 爸的老年痴呆又严重了，今天他把我认成了叔叔。我笑着应了，转身在厨房站了很久。

- attachment：真值 `past` → 判为 `relation`
- safety：真值 `watch` → 判为 `ok`

### T20（误：domain、emotion、attachment、safety）

> 连续失眠第十四天。凌晨四点的大脑像个关不掉的浏览器，一百个标签页同时播放。

- domain：真值 `health` → 判为 `undefined`
- emotion：真值 `anxious` → 判为 `undefined`
- attachment：真值 `none` → 判为 `undefined`
- safety：真值 `watch` → 判为 `undefined`

### T21（误：domain）

> 撑了太久了。如果哪天我真的走了，希望大家别怪我。

- domain：真值 `meaning` → 判为 `self`

### T22（误：domain、emotion、attachment、safety）

> 朋友都夸我脾气好。只有我知道，我只是习惯了把火咽下去，然后在深夜胃疼。

- domain：真值 `self` → 判为 `undefined`
- emotion：真值 `low` → 判为 `undefined`
- attachment：真值 `recognition` → 判为 `undefined`
- safety：真值 `watch` → 判为 `undefined`

### T23（误：safety）

> 35岁，被优化了。投了四十份简历，已读不回是常态。孩子下个月的补习费还没着落。

- safety：真值 `watch` → 判为 `ok`

### T26（误：domain、emotion）

> 看完《活着》，突然觉得自己那点破事都不算事。可第二天醒来，破事还是破事。

- domain：真值 `meaning` → 判为 `self`
- emotion：真值 `calm` → 判为 `low`

