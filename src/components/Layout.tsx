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
  MessageCircle,
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
  Gauge,
  Waves,
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

// 14 itens do menu principal: os 13 do briefing + 📱 WhatsApp / Cobranças.
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
  { path: '/whatsapp', label: 'WhatsApp / Cobranças', icon: MessageCircle, emoji: '📱' },
  { path: '/performance', label: 'Performance', icon: Gauge, emoji: '🎯' },
  { path: '/fluxo-de-caixa', label: 'Fluxo de Caixa', icon: Waves, emoji: '💧' },
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
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* SIDEBAR FIXA */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Halos de cor no topo da barra lateral */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-brand opacity-25 blur-3xl"
        />

        {/* Top Logo */}
        <div className="relative h-16 px-4 flex items-center justify-between border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-extrabold text-sm shadow-glow-brand ring-1 ring-gold-luminous/40">
              360
            </div>
            <div>
              <div className="font-extrabold text-[13px] tracking-tight text-white flex items-center gap-1.5">
                GESTOR IMOBILIÁRIO <span className="text-gold-luminous font-extrabold">360</span>
              </div>
              <div className="text-[10px] text-gold-light/85 uppercase tracking-[0.18em] font-semibold">
                Gestão Patrimonial
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-sidebar-foreground/60 hover:text-white p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo banner badge */}
        <div className="relative px-3 py-2 border-b border-gold-metallic/25 bg-gold-metallic/15 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gold-light font-semibold">
            <span className="w-2 h-2 rounded-full bg-gold-luminous animate-pulse shadow-glow-gold" />
            Dados Demonstrativos
          </span>
          <span className="text-[10px] bg-gold-metallic/30 text-white px-1.5 py-0.5 rounded-full font-bold border border-gold-metallic/40">
            Ativo
          </span>
        </div>

        {/* Navigation list */}
        <nav className="relative flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-brand text-white shadow-glow-brand scale-[1.02]'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white hover:translate-x-0.5'
                }`}
              >
                <span
                  className={`text-sm transition-transform duration-200 ${
                    isActive ? '' : 'group-hover:scale-110'
                  }`}
                >
                  {item.emoji}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.path === '/assistente-ia' && (
                  <Badge
                    variant="outline"
                    className="border-gold-metallic/60 text-gold-luminous text-[9px] px-1.5 py-0 uppercase bg-gold-metallic/20 font-bold"
                  >
                    IA
                  </Badge>
                )}
                {item.path === '/pendencias' && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-gradient-rose text-white border-transparent">
                    6
                  </Badge>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User Card at bottom of sidebar */}
        <div className="relative p-3 border-t border-sidebar-border bg-sidebar-background/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-gold-metallic/40">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Administrador'}
                </div>
                <div className="text-[10px] text-sidebar-foreground/60 truncate">
                  {roleLabels[role]}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-sidebar-foreground/60 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-xl px-4 flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global search input */}
            <form onSubmit={handleGlobalSearch} className="relative w-48 sm:w-72 md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Pesquisa global: imóvel, contrato, CPF, nome..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-muted/60 border-border rounded-full focus-visible:ring-2 focus-visible:ring-ring/60 transition-shadow"
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
                  className="hidden lg:flex items-center gap-1.5 text-xs h-8 rounded-full"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Perfil: <strong>{roleLabels[role]}</strong>
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
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
                    className={`text-xs ${role === r ? 'font-bold text-primary' : ''}`}
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
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
                  className="relative h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                >
                  <Bell className="w-4 h-4" />
                  {naoLidas.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-rose animate-ping" />
                  )}
                  {naoLidas.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-rose" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="p-2 flex items-center justify-between border-b border-border">
                  <span className="font-semibold text-xs">Notificações Inteligentes</span>
                  <Badge className="text-[10px] bg-gradient-brand border-transparent text-white">
                    {naoLidas.length} novas
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {notificacoes.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
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
                        className={`p-3 text-xs cursor-pointer hover:bg-accent/60 transition-colors ${
                          !n.lida ? 'bg-accent/40' : ''
                        }`}
                      >
                        <div className="font-medium text-foreground mb-0.5">{n.titulo}</div>
                        <div className="text-muted-foreground text-[11px] leading-relaxed">
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
              className="text-xs h-8 gap-1.5 hidden sm:flex rounded-full"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assistente IA</span>
            </Button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background page-mesh">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
