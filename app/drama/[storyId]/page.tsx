import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import StoryInterface from '@/components/drama/StoryInterface';
import { getStoryConfig } from '@/lib/drama-stories';

interface StoryPageProps {
  params: Promise<{
    storyId: string;
  }>;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const session = await auth();
  const { storyId } = await params;

  if (!session?.user) {
    redirect('/login');
  }

  // 验证故事是否存在
  const story = getStoryConfig(storyId);
  if (!story) {
    redirect('/drama');
  }

  return <StoryInterface storyId={storyId} />;
}
