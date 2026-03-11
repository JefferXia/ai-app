import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Aura (微光) - AI助眠小助手',
  description: 'Aura (微光) 是一个AI助眠小助手，可以帮助你放松身心，进入梦乡。',
  keywords: 'Aura,微光,AI陪伴,AI助眠,AI睡眠,AI睡眠助手,情感陪伴,AI情感陪伴,AI情感陪伴助手',
  authors: [{ name: '微光(杭州)人工智能应用技术有限公司' }],
  openGraph: {
    title: 'Aura (微光) - AI助眠小助手',
    description: 'Aura (微光) 是一个AI助眠小助手，可以帮助你放松身心，进入梦乡。',
    type: 'website',
  },
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return <div className=''>{children}</div>;
};

export default Layout;
