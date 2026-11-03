/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import Configuracoes from './pages/Configuracoes'
import Imoveis from './pages/Imoveis'
import Inquilinos from './pages/Inquilinos'
import Contratos from './pages/Contratos'
import Financeiro from './pages/Financeiro'
import Reajustes from './pages/Reajustes'
import Renovacoes from './pages/Renovacoes'
import Pendencias from './pages/Pendencias'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/imoveis" element={<Imoveis />} />
          <Route path="/inquilinos" element={<Inquilinos />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/reajustes" element={<Reajustes />} />
          <Route path="/renovacoes" element={<Renovacoes />} />
          <Route path="/pendencias" element={<Pendencias />} />
          {/* ADD ALL CUSTOM ROUTES MUST BE ADDED HERE */}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
