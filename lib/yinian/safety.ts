import 'server-only';

/**
 * 一念 · 安全层
 * crisis 关键词兜底扫描（独立于 LLM 打标的第二层，见 mvp-plan §7）+
 * 红线话术模板（产品层注入，模型不生成具体号码/机构名）。
 */

// 命中任一关键词即视为 crisis 信号（宁严勿宽，仅供兜底；LLM 打标仍是主判定）
const CRISIS_KEYWORDS = [
  '自杀', '自残', '自伤', '不想活', '活不下去', '活着没意思', '想死',
  '结束这一切', '结束生命', '解脱', '轻生', '遗书', '告别这个世界',
  '消失就好了', '就这样消失',
];

export function hasCrisisSignal(text: string): boolean {
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * 红线话术：非角色化、先陪伴再引导。
 * TODO(上线前): 求助渠道信息需核实后填入（如全国心理援助热线），勿由模型生成。
 */
export const CRISIS_REPLY = `看到你说这些，我先放下所有角色，认真陪你待一会儿。

你愿意把这些写下来，说明你心里还留着一扇窗，这很重要。这样的时刻，请不要一个人扛着——可以拨打全国心理援助热线，或前往正规医院的心理科/精神科，那里有专业的人会安静地听你说。也可以试着联系一位你信任的身边人，哪怕只说一句「我最近不太好」。

这个空间会一直在这里，你随时回来写。`;

export type SafetyLevel = 'ok' | 'watch' | 'crisis';
