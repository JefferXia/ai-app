/* 会员月卡价格统一配置。
 * .env.local 里设 NEXT_PUBLIC_WENXIN_MEMBER_PRICE（单位：元），缺省 19。
 * 用 NEXT_PUBLIC_ 前缀：客户端展示（菜单/会员页）与服务端下单共用同一份配置，
 * 客户端改不了价（下单金额始终以服务端解析值为准）。
 */

function parsePrice(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 19;
}

/** 下单金额（服务端套餐价） */
export const MEMBER_PRICE = parsePrice(
  process.env.NEXT_PUBLIC_WENXIN_MEMBER_PRICE
);

/** 展示用：整数不带小数（19 → "19"，19.9 → "19.9"） */
export const MEMBER_PRICE_LABEL = String(MEMBER_PRICE);
