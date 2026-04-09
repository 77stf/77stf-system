import { Sidebar } from './components/sidebar'
import { TopBar } from './components/top-bar'
import { CommandPaletteProvider } from '@/components/ui/command-palette-provider'
import { PageTransition } from '@/components/ui/page-transition'
import { createSupabaseServerClient } from '@/lib/supabase'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <CommandPaletteProvider>
      <div
        className="flex min-h-screen"
        style={{
          // Warm charcoal gray — subtle directional light from top-left
          background: 'linear-gradient(150deg, #161619 0%, #0F0F12 100%)',
          minHeight: '100vh',
        }}
      >
        <Sidebar userEmail={user?.email} />
        <div className="flex flex-col flex-1" style={{ marginLeft: 240 }}>
          <TopBar userEmail={user?.email} />
          <main style={{ flex: 1, padding: '24px 28px', minWidth: 0 }}>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
