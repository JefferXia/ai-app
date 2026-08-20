/* ===== 接口地址：开发时用 LAN IP 指向本地 Next.js，线上用正式域名 =====
 * EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start */

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://www.wenxinbiji.com';
