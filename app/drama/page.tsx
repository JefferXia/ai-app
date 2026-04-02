import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import DramaInterface from '@/components/drama/DramaInterface';

export default async function DramaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <DramaInterface />;
}