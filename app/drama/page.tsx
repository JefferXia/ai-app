import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import StorySelect from '@/components/drama/StorySelect';

export default async function DramaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <StorySelect />;
}