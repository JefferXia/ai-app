import { auth } from '@/app/(auth)/auth';
import { redirect, notFound } from 'next/navigation';
import { getCharacterConfig } from '@/lib/drama-characters';
import DramaInterface from '@/components/drama/DramaInterface';

interface Props {
  params: Promise<{ characterId: string }>;
}

export default async function DramaCharacterPage({ params }: Props) {
  const session = await auth();
  const { characterId } = await params;

  if (!session?.user) {
    redirect('/login');
  }

  // 验证角色是否存在
  const character = getCharacterConfig(characterId);
  if (!character) {
    notFound();
  }

  return <DramaInterface characterId={characterId} />;
}