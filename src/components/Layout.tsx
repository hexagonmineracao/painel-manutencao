import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/machines', label: 'Máquinas' },
  { to: '/fuel-deliveries', label: 'Entrada de combustível' },
  { to: '/materials', label: 'Estoque' },
  { to: '/reports', label: 'Relatórios' },
  { to: '/metrics', label: 'Métricas' },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  const navLinkClass =
    'px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100'

  const visibleLinks = profile?.role === 'admin' ? [...links, { to: '/users', label: 'Usuários' }] : links

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="font-semibold text-slate-900 shrink-0">
              Painel Manutenção
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {visibleLinks.map((link) => (
                <Link key={link.to} to={link.to} className={navLinkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-sm">
            <Link to="/account" className="text-slate-500 hover:text-slate-900">
              {profile?.full_name}
            </Link>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-slate-900">
              Sair
            </button>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menu"
            className="lg:hidden p-2 -mr-2 text-slate-700"
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-slate-200 px-2 py-2">
            {visibleLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-slate-200 mt-2 pt-2">
              <Link
                to="/account"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {profile?.full_name} · Minha conta
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sair
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
