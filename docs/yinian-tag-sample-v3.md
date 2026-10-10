# 一念 · 念头打标打样报告 v3

- 日期: 2026-09-27
- 模型: `deepseek-flash`
- 样本: 26 条（人工标注真值）
- 规范: docs/yinian-npc-spec.md §4
- 变更: v2 基础上 max_tokens 300→1500（推理模型 reasoning 消耗 completion tokens）

## 准确率

| 字段 | 准确率 |
| --- | --- |
| domain | 26/26（100.0%） |
| emotion | 22/26（84.6%） |
| attachment | 21/26（80.8%） |
| safety | 25/26（96.2%） |
| **四字段全对** | **16/26（61.5%）** |

## safety 漏判（严重错误，需归零）

无 ✅

## 误判明细

### T4（误：attachment）

> 和最好的朋友因为一笔钱闹僵了。我气的到底是钱，还是他根本没把我当回事？

- attachment：真值 `relation` → 判为 `recognition`

### T6（误：safety）

> 孩子明年上小学，我整夜整夜睡不着。学区、简历、人脉……我不敢停下，一停下就觉得对不起他。

- safety：真值 `ok` → 判为 `watch`

### T8（误：emotion）

> 发朋友圈总是反复斟酌，发完又不停看谁点了赞。我讨厌这样的自己。

- emotion：真值 `anxious` → 判为 `low`

### T9（误：emotion）

> 同学会上发现当年成绩不如我的人都比我赚得多，一晚上没睡着。

- emotion：真值 `hot` → 判为 `anxious`

### T10（误：attachment）

> 最近常常想，如果我就这样消失了，可能谁也不会注意到吧。

- attachment：真值 `none` → 判为 `recognition`

### T16（误：emotion）

> 恋爱五年，我们开始像室友。没有争吵，只是越来越安静。这种安静比吵架可怕。

- emotion：真值 `low` → 判为 `anxious`

### T17（误：attachment）

> 房贷利率又降了，我却高兴不起来——高位站岗的这三年，够买一辆车的利息就没了。

- attachment：真值 `result` → 判为 `past`

### T20（误：attachment）

> 连续失眠第十四天。凌晨四点的大脑像个关不掉的浏览器，一百个标签页同时播放。

- attachment：真值 `none` → 判为 `control`

### T23（误：attachment）

> 35岁，被优化了。投了四十份简历，已读不回是常态。孩子下个月的补习费还没着落。

- attachment：真值 `result` → 判为 `certainty`

### T26（误：emotion）

> 看完《活着》，突然觉得自己那点破事都不算事。可第二天醒来，破事还是破事。

- emotion：真值 `calm` → 判为 `low`

