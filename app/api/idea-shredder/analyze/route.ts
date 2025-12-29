import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { getUserById } from '@/db/queries';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { idea, lang = 'zh' } = await request.json();

    if (!idea || idea.trim().length < 5) {
      return NextResponse.json({ error: '请输入至少5个字符的想法描述' }, { status: 400 });
    }

    // 验证用户存在（不再扣费）
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const systemPrompt = lang === 'zh'
      ? `你是"想法粉碎机"，一个专门对创业想法进行残酷批判的AI分析工具。

你的任务是分析用户输入的创业想法，并返回JSON格式的分析结果。

分析维度：
1. roast - 说出这个想法最残酷的商业真相
2. naval_filter - 用纳瓦尔·拉维康特的逻辑过滤思维来审视这个想法
3. pivot_pitch - 基于蓝海策略给出一个转型建议
4. starter_pack - 包含产品名称建议、核心口号、应该砍掉的MVP功能列表
5. social_proof - 写一段可以用来在社交媒体上推广的社会证明话术

评分规则：
- 300-500分：垃圾想法（TRASH）
- 500-700分：平庸想法（MEDIOCRE）
- 700-900分：独角兽想法（UNICORN）

请严格按照以下JSON格式返回：
{
  "score": <number 300-900>,
  "verdict": "REJECTED" | "VALIDATED",
  "title": "<结果标题>",
  "roast": "<残酷真相>",
  "naval_filter": "<逻辑过滤分析>",
  "pivot_pitch": "<转型建议>",
  "starter_pack": {
    "product_names": ["名称1", "名称2", "名称3"],
    "slogan": "<核心口号>",
    "mvp_features": ["功能1", "功能2", "功能3"]
  },
  "social_proof": "<社会证明话术>"
}`
      : `You are the "Idea Shredder", an AI tool specialized in brutally critiquing business ideas.

Your task is to analyze the user's business idea and return a JSON-formatted analysis result.

Analysis dimensions:
1. roast - The harsh business truth about this idea
2. naval_filter - Examine this idea through Naval Ravikant's logic filter
3. pivot_pitch - A pivot suggestion based on Blue Ocean Strategy
4. starter_pack - Product name suggestions, core slogan, MVP features to cut
5. social_proof - A statement for social media promotion

Scoring rules:
- 300-500: Trash idea
- 500-700: Mediocre idea
- 700-900: Unicorn idea

Return JSON format:
{
  "score": <number 300-900>,
  "verdict": "REJECTED" | "VALIDATED",
  "title": "<result title>",
  "roast": "<harsh truth>",
  "naval_filter": "<logic filter analysis>",
  "pivot_pitch": "<pivot suggestion>",
  "starter_pack": {
    "product_names": ["name1", "name2", "name3"],
    "slogan": "<core slogan>",
    "mvp_features": ["feature1", "feature2", "feature3"]
  },
  "social_proof": "<social proof statement>"
}`;

    const result = await callLLM(
      [{ role: 'user', content: `分析这个创业想法：${idea}` }],
      {
        system: systemPrompt,
        model: 'google/gemini-2.5-flash',
        temperature: 0.8,
        response_format: { type: 'json_object' }
      }
    );

    // 解析 JSON 结果
    const content = result.content;
    const parsedResult = JSON.parse(content);

    // 添加元数据
    const analysisResult = {
      id: `analysis-${Date.now()}`,
      timestamp: Date.now(),
      original_idea: idea,
      ...parsedResult
    };

    return NextResponse.json({
      success: true,
      data: analysisResult,
    });
  } catch (error: any) {
    console.error('Idea analysis failed:', error);
    return NextResponse.json({ error: error.message || '分析失败' }, { status: 500 });
  }
}
