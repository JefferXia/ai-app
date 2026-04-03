import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import CharacterSelect from '@/components/drama/CharacterSelect';

export default async function DramaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <CharacterSelect />;
}