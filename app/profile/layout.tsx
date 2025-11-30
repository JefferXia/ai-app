import { auth } from '@/app/(auth)/auth'
import { notFound } from "next/navigation"
import { AppSidebar } from '@/components/custom/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth()
  if (!session || !session?.user || !session?.user?.id) {
    return notFound()
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar user={session?.user} />
      <main className='flex-1'>{children}</main>
    </SidebarProvider>
  );
}
