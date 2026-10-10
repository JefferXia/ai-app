import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // 一念：发布念头后异步生成 NPC 点评（app/api/yinian/thoughts/route.ts）
    after: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: '*.cos.ap-nanjing.myqcloud.com',
      },
      {
        hostname: '*.cos.ap-shanghai.myqcloud.com',
      },
      {
        hostname: 'thirdwx.qlogo.cn',
      },
      {
        hostname: 'picsum.photos',
      },
    ],
  },
  reactStrictMode: false,
};

export default nextConfig;
