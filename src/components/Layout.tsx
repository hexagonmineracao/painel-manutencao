import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navLinkClass =
    'px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <nav className="flex items-center gap-1">
            <Link to="/" className="font-semibold text-slate-900 mr-4">
              Painel Manutenção
            </Link>
            <Link to="/" className={navLinkClass}>
              Dashboard
            </Link>
            <Link to="/machines" className={navLinkClass}>
              Máquinas
            </Link>
            <Link to="/fuel-deliveries" className={navLinkClass}>
              Entrada de combustível
            </Link>
            <Link to="/reports" className={navLinkClass}>
              Relatórios
            </Link>
            {profile?.role === 'admin' && (
              <Link to="/users" className={navLinkClass}>
                Usuários
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/account" className="text-slate-500 hover:text-slate-900">
              {profile?.full_name}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-900"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
