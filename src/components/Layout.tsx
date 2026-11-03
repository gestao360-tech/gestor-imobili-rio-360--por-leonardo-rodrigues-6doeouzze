import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Calendar,
  AlertTriangle,
  FolderOpen,
  BarChart3,
  Bot,
  Settings,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { getNotificacoes, marcarNotificacaoLida } from '@/services/imobiliario'
import { NotificacaoModel, UserRole } from '@/types/database'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 13 itens exatos do menu principal solicitados no briefing:
// 🏠 Visão Geral · 🏢 Imóveis · 👥 Inquilinos · 📄 Contratos · 💰 Financeiro · 📈 Reajustes · 🔄 Renovações · 📅 Agenda · ⚠️ Pendências · 📁 Documentos · 📊 Relatórios · 🤖 Assistente IA · ⚙️ Configurações
const navItems = [
  { path: '/', label: 'Visão Geral', icon: Home, emoji: '🏠' },
  { path: '/imoveis', label: 'Imóveis', icon: Building2, emoji: '🏢' },
  { path: '/inquilinos', label: 'Inquilinos', icon: Users, emoji: '👥' },
  { path: '/contratos', label: 'Contratos', icon: FileText, emoji: '📄' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, emoji: '💰' },
  { path: '/reajustes', label: 'Reajustes', icon: TrendingUp, emoji: '📈' },
  { path: '/renovacoes', label: 'Renovações', icon: RefreshCw, emoji: '🔄' },
  { path: '/agenda', label: 'Agenda', icon: Calendar, emoji: '📅' },
  { path: '/pendencias', label: 'Pendências', icon: AlertTriangle, emoji: '⚠️' },
  { path: '/documentos', label: 'Documentos', icon: FolderOpen, emoji: '📁' },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, emoji: '📊' },
  { path: '/assistente-ia', label: 'Assistente IA', icon: Bot, emoji: '🤖' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, emoji: '⚙️' },
]

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { user, role, switchRoleForTesting, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [notificacoes, setNotificacoes] = useState<NotificacaoModel[]>([])
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)

  useEffect(() => {
    loadNotifs()
  }, [])

  const loadNotifs = async () => {
    try {
      const list = await getNotificacoes()
      setNotificacoes(list)
    } catch {
      /* intentionally ignored */
    }
  }

  const naoLidas = notificacoes.filter((n) => !n.lida)

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!globalSearch.trim()) return
    // Navigate with search query parameter to imoveis or contratos
    navigate(`/imoveis?search=${encodeURIComponent(globalSearch.trim())}`)
  }

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador Geral',
    gestor: 'Gestor Imobiliário',
    financeiro: 'Financeiro',
    juridico: 'Jurídico',
    proprietario: 'Proprietário',
    inquilino: 'Inquilino',
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* SIDEBAR FIXA */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              360
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                GESTOR IMOBILIÁRIO <span className="text-emerald-400 font-bold">360</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                Gestão Patrimonial
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo banner badge */}
        <div className="px-3 py-2 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Dados Demonstrativos
          </span>
          <span className="text-[10px] bg-emerald-900 text-emerald-200 px-1.5 py-0.5 rounded">
            Ativo
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="text-sm">{item.emoji}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.path === '/assistente-ia' && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-300 text-[9px] px-1 py-0 uppercase"
                  >
                    IA
                  </Badge>
                )}
                {item.path === '/pendencias' && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    6
                  </Badge>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User Card at bottom of sidebar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-medium text-white truncate">
                  {user?.name || 'Administrador'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{roleLabels[role]}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global search input */}
            <form onSubmit={handleGlobalSearch} className="relative w-48 sm:w-72 md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Pesquisa global: imóvel, contrato, CPF, nome..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-emerald-500"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            {/* Perfil Switcher dropdown (for auditing all 6 roles) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden lg:flex items-center gap-1.5 text-xs h-8"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Perfil: <strong>{roleLabels[role]}</strong>
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Alternar Perfil de Acesso</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(
                  [
                    'admin',
                    'gestor',
                    'financeiro',
                    'juridico',
                    'proprietario',
                    'inquilino',
                  ] as UserRole[]
                ).map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => switchRoleForTesting(r)}
                    className={`text-xs ${role === r ? 'font-bold text-emerald-600' : ''}`}
                  >
                    {roleLabels[r]} {role === r && '✓'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dark / Light mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-slate-600 dark:text-slate-300"
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {/* Notification Bell */}
            <DropdownMenu open={notifDropdownOpen} onOpenChange={setNotifDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-slate-600 dark:text-slate-300"
                >
                  <Bell className="w-4 h-4" />
                  {naoLidas.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                  {naoLidas.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="p-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-xs">Notificações Inteligentes</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {naoLidas.length} novas
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notificacoes.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhuma notificação no momento.
                    </div>
                  ) : (
                    notificacoes.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.lida) {
                            await marcarNotificacaoLida(n.id)
                            loadNotifs()
                          }
                          if (n.link_destino) navigate(n.link_destino)
                          setNotifDropdownOpen(false)
                        }}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          !n.lida ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100 mb-0.5">
                          {n.titulo}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                          {n.mensagem}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Direct Quick Assistant Trigger */}
            <Button
              size="sm"
              onClick={() => navigate('/assistente-ia')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 hidden sm:flex"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assistente IA</span>
            </Button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
