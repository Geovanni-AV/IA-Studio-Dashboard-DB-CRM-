import React, { useState } from 'react';
import { CRMRecord, UserRole } from '../types';
import { 
  TrendingUp, 
  CheckCircle, 
  BarChart2, 
  DollarSign, 
  Globe, 
  Award, 
  Layers, 
  RefreshCw, 
  Search, 
  Bell, 
  Settings, 
  MapPin, 
  ArrowUpRight,
  TrendingDown,
  Percent,
  Calendar,
  Users,
  Target
} from 'lucide-react';

interface DashboardProps {
  records: CRMRecord[];
  exchangeRate: number;
  currentCurrency: 'USD' | 'MXN';
  role: UserRole;
  isSupabaseConfigured?: boolean;
  isSupabaseLoading?: boolean;
  onEditRecord: (record: CRMRecord) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  records,
  exchangeRate,
  currentCurrency,
  role,
  isSupabaseConfigured,
  isSupabaseLoading,
  onEditRecord,
  onNavigate
}: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedStatus, setSelectedStatus] = useState('Todos los estatus');
  const [selectedCountry, setSelectedCountry] = useState('Todos los países');

  // Badge utility for DEMO labels to strictly comply with user instruction
  const DemoBadge = () => (
    <span className="ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-mono font-bold tracking-wider rounded border border-amber-250 animate-pulse">
      DEMO
    </span>
  );

  return (
    <div className="space-y-6 fade-in pb-12" id="dashboard-tab-content">
      {/* Redesign Notice & Status Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="p-1 px-2.5 bg-white/20 font-mono font-black text-xs rounded-full border border-white/30 tracking-widest animate-pulse">
            VISTA REDISEÑADA
          </span>
          <div>
            <p className="text-xs font-bold leading-normal">
              Rediseño Ejecutivo del Dashboard Activo 
            </p>
            <p className="text-[10px] text-amber-100 font-medium">
              Siguiendo sus instrucciones, se muestra la nueva estructura de pipeline con indicadores preliminares identificados como <strong>[DEMO]</strong>.
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-white/20 font-bold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
          Estructura Rediseño v2.5
        </span>
      </div>

      {/* Title & Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-md text-2xl font-black text-slate-900 tracking-tight">
              Dashboard de pipeline y cierres
            </h1>
            <DemoBadge />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualización ejecutiva de metas anuales, volumen de leads y distribución geográfica.
          </p>
        </div>

        {/* Controls exactly as shown in the mockup */}
        <div className="flex flex-wrap gap-2.5">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none font-medium cursor-pointer"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
          
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none font-medium cursor-pointer min-w-[150px]"
          >
            <option value="Todos los estatus">Todos los estatus</option>
            <option value="Propuesta">Propuesta</option>
            <option value="Negociación">Negociación</option>
            <option value="Ganado">Cerrado Ganado</option>
          </select>

          <select 
            value={selectedCountry} 
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none font-medium cursor-pointer min-w-[150px]"
          >
            <option value="Todos los países">Todos los países</option>
            <option value="México">México</option>
            <option value="EE.UU.">EE.UU.</option>
          </select>
        </div>
      </div>

      {/* SECTION 1: PIPELINE GENERAL (7 cards format) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            PIPELINE GENERAL
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">Información preliminar • <DemoBadge /></span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          
          {/* Card 1: Proyectos Activos */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-slate-400 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  PROYECTOS ACTIVOS
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                52
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
              en seguimiento
            </p>
          </div>

          {/* Card 2: Pipeline 2026 */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  PIPELINE 2026
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $4.0M
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
              total proyectado
            </p>
          </div>

          {/* Card 3: Pipeline 2027 */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-amber-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  PIPELINE 2027
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $459K
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
              proyectado
            </p>
          </div>

          {/* Card 4: Hot Amount */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  HOT AMOUNT
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $301K
              </p>
            </div>
            <span className="self-start inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] rounded-full font-bold border border-blue-100 leading-none mt-1">
              Alta probabilidad
            </span>
          </div>

          {/* Card 5: Warm Amount */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-amber-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  WARM AMOUNT
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $582K
              </p>
            </div>
            <span className="self-start inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] rounded-full font-bold border border-amber-100 leading-none mt-1">
              Media probabilidad
            </span>
          </div>

          {/* Card 6: Cool Amount */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-slate-400 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  COOL AMOUNT
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $3.3M
              </p>
            </div>
            <span className="self-start inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-700 text-[9px] rounded-full font-bold border border-slate-100 leading-none mt-1 font-sans">
              En exploración
            </span>
          </div>

          {/* Card 7: Win Amount */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  WIN AMOUNT
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $467K
              </p>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">
              Ganado este año
            </p>
          </div>

        </div>
      </div>

      {/* SECTION 2: VENTAS & METAS (7 cards format) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            VENTAS &amp; METAS
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">Indicadores consolidados • <DemoBadge /></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">

          {/* Card 1: Meta Anual */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  META ANUAL
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $5.1M
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              objetivo 2026
            </p>
          </div>

          {/* Card 2: Ventas Reales YTD */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  VENTAS REALES
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $1.5M
              </p>
            </div>
            <p className="text-[9px] text-emerald-600 font-bold leading-none">
              +12% vs mismo periodo 2025
            </p>
          </div>

          {/* Card 3: Cumplimiento */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  CUMPLIMIENTO
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                28%
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              de cuota anual
            </p>
          </div>

          {/* Card 4: Pipeline Coverage */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  PIPELINE COVERAGE
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                1x
              </p>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              ratio vs meta <span className="text-slate-500">(3-4x ideal)</span>
            </p>
          </div>

          {/* Card 5: Ticket Promedio */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  TICKET PROMEDIO
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $95K
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              por oportunidad
            </p>
          </div>

          {/* Card 6: Win Rate */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase">
                  WIN RATE
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                92%
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              benchmark: 35-45%
            </p>
          </div>

          {/* Card 7: Slippage Rate */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-amber-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between min-h-[110px]">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  SLIPPAGE RATE
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                18%
              </p>
            </div>
            <span className="self-start inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-full font-bold border border-amber-200 mt-1">
              Watch &lt;30%
            </span>
          </div>

        </div>
      </div>

      {/* SECTION 3: LEADS & CRM (7 cards format) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            LEADS &amp; CRM
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">Estadísticas de Conversión • <DemoBadge /></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">

          {/* Card 1: Total Leads */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  TOTAL LEADS
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                144
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              últimos 6 meses
            </p>
          </div>

          {/* Card 2: MQL */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  MQL
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                79
              </p>
            </div>
            <p className="text-[9px] text-slate-500 font-medium">
              leads calificados mktg
            </p>
          </div>

          {/* Card 3: SQL */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  SQL
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                46
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              calificados por ventas
            </p>
          </div>

          {/* Card 4: Conv. Promedio */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  CONV. PROMEDIO
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                31%
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              lead → oportunidad
            </p>
          </div>

          {/* Card 5: Ciclo de Venta */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-amber-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  CICLO DE VENTA
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                74d
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              promedio días cierre
            </p>
          </div>

          {/* Card 6: CAC Estimado */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-blue-600 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  CAC ESTIMADO
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                $8K
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              costo adq. cliente
            </p>
          </div>

          {/* Card 7: LTV / CAC */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition hover:translate-y-[-2px] duration-200 relative flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
                  LTV / CAC
                </span>
                <DemoBadge />
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                4.2x
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              retorno sobre adq.
            </p>
          </div>

        </div>
      </div>

      {/* DETAILED CHARTS GRID SECTION 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">

        {/* Chart 1: Proyección vs ventas reales por mes */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                Proyección vs ventas reales por mes
              </h3>
              <DemoBadge />
            </div>

            {/* Custom chart legend matches screenshot */}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 mb-6 uppercase">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#8b5cf6]/30 border border-[#8b5cf6] rounded-xs"></span>
                Meta mensual
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#10b981] rounded-xs animate-pulse"></span>
                Ventas reales
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#ef4444] inline-block"></span>
                <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block -ml-1"></span>
                Proyección
              </div>
            </div>

            {/* Responsive Height Balanced Graph Bars */}
            <div className="h-48 relative flex items-end justify-between border-b border-l border-slate-200 pb-0.5 px-3">
              {/* Ene */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-32 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[65%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Ene</span>
              </div>

              {/* Feb */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-36 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[75%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Feb</span>
              </div>

              {/* Mar */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-40 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[85%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Mar</span>
              </div>

              {/* Abr */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-32 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[35%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Abr</span>
              </div>

              {/* May */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-44 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[45%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">May</span>
              </div>

              {/* Jun */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-5 sm:w-6 h-44 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="w-full h-[55%] bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/90 transition"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Jun</span>
              </div>

              {/* Jul */}
              <div className="flex flex-col items-center flex-1 group relative">
                <div className="w-5 sm:w-6 h-48 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Jul</span>
              </div>

              {/* Ago */}
              <div className="flex flex-col items-center flex-1 group relative animate-pulse">
                <div className="w-5 sm:w-6 h-48 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Ago</span>
              </div>

              {/* Sep */}
              <div className="flex flex-col items-center flex-1 group relative">
                <div className="w-5 sm:w-6 h-42 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Sep</span>
              </div>

              {/* Oct */}
              <div className="flex flex-col items-center flex-1 group relative">
                <div className="w-5 sm:w-6 h-42 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Oct</span>
              </div>

              {/* Nov */}
              <div className="flex flex-col items-center flex-1 group relative">
                <div className="w-5 sm:w-6 h-36 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Nov</span>
              </div>

              {/* Dic */}
              <div className="flex flex-col items-center flex-1 group relative">
                <div className="w-5 sm:w-6 h-36 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10"></div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold">Dic</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono italic">
            * Valores de tendencia proyectada mensual expresados en formato DEMO interactivo.
          </p>
        </div>

        {/* Chart 2: Pipeline por trimestre (proyección) */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
                Pipeline por trimestre (proyección)
              </h3>
              <DemoBadge />
            </div>

            {/* Trimester stacked chart legend */}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 mb-6 uppercase">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#004ddf] rounded-xs inline-block"></span>
                Hot
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#f59e0b] rounded-xs inline-block"></span>
                Warm
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-slate-200 rounded-xs inline-block"></span>
                Cool
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#8b5cf6] inline-block"></span>
                Meta
              </div>
            </div>

            {/* Stacked interactive bars */}
            <div className="h-48 relative flex items-end justify-around border-b border-l border-slate-200 pb-0.5 px-2">
              
              {/* Q3 2025 */}
              <div className="flex flex-col items-center w-12 group relative">
                <div className="w-8 flex flex-col justify-end h-32 space-y-0.5 transition-all">
                  <div className="h-[20%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs" title="Cool segment"></div>
                  <div className="h-[15%] bg-[#f59e0b] hover:bg-[#f59e0b]/90 transition" title="Warm segment"></div>
                  <div className="h-[40%] bg-white" title="Empty base"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2025-Q3
                </span>
                <span className="absolute top-1 text-[9px] font-bold font-mono text-slate-700 opacity-0 group-hover:opacity-100 transition bg-white/90 p-1 rounded shadow-xs z-10 whitespace-nowrap">
                  Cool: 20% | Warm: 15%
                </span>
              </div>

              {/* Q4 2025 */}
              <div className="flex flex-col items-center w-12 group relative">
                <div className="w-8 flex flex-col justify-end h-36 space-y-0.5">
                  <div className="h-[25%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[5%] bg-[#f59e0b] hover:bg-[#f59e0b]/90 transition"></div>
                  <div className="h-[50%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2025-Q4
                </span>
              </div>

              {/* Q1 2026 */}
              <div className="flex flex-col items-center w-12 group">
                <div className="w-8 flex flex-col justify-end h-36 space-y-0.5">
                  <div className="h-[30%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[70%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2026-Q1
                </span>
              </div>

              {/* Q2 2026 */}
              <div className="flex flex-col items-center w-12 group">
                <div className="w-8 flex flex-col justify-end h-44 space-y-0.5">
                  <div className="h-[40%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[20%] bg-[#f59e0b] hover:bg-[#f59e0b]/90 transition"></div>
                  <div className="h-[15%] bg-[#004ddf] hover:bg-[#004ddf]/90 transition"></div>
                  <div className="h-[25%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2026-Q2
                </span>
              </div>

              {/* Q3 2026 */}
              <div className="flex flex-col items-center w-12 group">
                <div className="w-8 flex flex-col justify-end h-38 space-y-0.5">
                  <div className="h-[30%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[15%] bg-[#f59e0b] hover:bg-[#f59e0b]/90 transition"></div>
                  <div className="h-[55%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2026-Q3
                </span>
              </div>

              {/* Q4 2026 */}
              <div className="flex flex-col items-center w-12 group">
                <div className="w-8 flex flex-col justify-end h-40 space-y-0.5">
                  <div className="h-[40%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[60%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2026-Q4
                </span>
              </div>

              {/* Q1 2027 */}
              <div className="flex flex-col items-center w-12 group">
                <div className="w-8 flex flex-col justify-end h-32 space-y-0.5">
                  <div className="h-[20%] bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"></div>
                  <div className="h-[80%] bg-white"></div>
                </div>
                <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-45 leading-none h-4">
                  2027-Q1
                </span>
              </div>

            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono italic">
            * Gráfico de pila acumulada trimestral basada en valores DEMO.
          </p>
        </div>

      </div>

      {/* DETAILED CHARTS GRID SECTION 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

        {/* Chart 3: Funnel de conversión — CRM */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                Funnel de conversión — CRM
              </h3>
              <DemoBadge />
            </div>

            {/* Horizontal progress steps */}
            <div className="space-y-4">
              
              {/* Leads */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">Leads</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#a78bfa] rounded-full transition-all" style={{ width: '100%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">144</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">144</div>
              </div>

              {/* MQL */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">MQL</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#8b5cf6] rounded-full transition-all" style={{ width: '55%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">79</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">
                  79 <span className="text-[9px] text-slate-500 font-normal">(55%)</span>
                </div>
              </div>

              {/* SQL */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">SQL</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#6d28d9] rounded-full transition-all" style={{ width: '32%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">46</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">
                  46 <span className="text-[9px] text-slate-500 font-normal">(58%)</span>
                </div>
              </div>

              {/* Propuesta */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">Propuesta</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#4c1d95] rounded-full transition-all" style={{ width: '20%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">28</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">
                  28 <span className="text-[9px] text-slate-500 font-normal">(61%)</span>
                </div>
              </div>

              {/* Negociación */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">Negociación</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#f59e0b] rounded-full transition-all" style={{ width: '10%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">14</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">
                  14 <span className="text-[9px] text-slate-500 font-normal">(50%)</span>
                </div>
              </div>

              {/* Ganado */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase font-sans">Ganado</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#10b981] rounded-full transition-all" style={{ width: '4%' }}></div>
                  <span className="relative z-10 text-[10px] font-bold text-emerald-800 ml-1">✓</span>
                </div>
                <div className="w-16 text-right text-xs font-bold text-slate-900 shrink-0 ml-4">
                  6 <span className="text-[9px] text-slate-500 font-normal">(43%)</span>
                </div>
              </div>

            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono">
            * Distribución porcentual según funnel de conversión demo de CRM comercial.
          </p>
        </div>

        {/* Chart 4: Cumplimiento de cuota por vendedor */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                Cumplimiento de cuota por vendedor
              </h3>
              <DemoBadge />
            </div>

            {/* List with progress of Sales Representative quotas */}
            <div className="space-y-6">
              
              {/* Carlos M. */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-900">Carlos M.</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600">
                    $467K / $800K · <span className="text-red-500 font-bold">58%</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: '58%' }}></div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">6 oportunidades activas</p>
              </div>

              {/* Ana R. */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-900">Ana R.</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600">
                    $310K / $600K · <span className="text-red-500 font-bold">52%</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: '52%' }}></div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">4 oportunidades activas</p>
              </div>

              {/* Luis T. */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-900">Luis T.</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600">
                    $180K / $500K · <span className="text-red-500 font-bold">36%</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: '36%' }}></div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">8 oportunidades activas</p>
              </div>

              {/* Sofía V. */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-900">Sofía V.</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600">
                    $420K / $700K · <span className="text-amber-500 font-bold">60%</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: '60%' }}></div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">5 oportunidades activas</p>
              </div>

            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono">
            * Representaciones individuales basadas en asignaciones cuotificadas demo.
          </p>
        </div>

      </div>

      {/* DETAILED CHARTS GRID SECTION 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

        {/* Chart 5: Leads por fuente & conversión */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                Leads por fuente &amp; conversión
              </h3>
              <DemoBadge />
            </div>

            {/* Custom columns chart */}
            <div className="h-44 relative flex items-end justify-between border-b border-l border-slate-200 pb-0.5 px-4 md:px-8 mt-4">
              
              {/* Referidos */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-8 md:w-10 h-28 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="60%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  Referidos
                </span>
              </div>

              {/* Web */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-8 md:w-10 h-38 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="90%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  Web/Inbound
                </span>
              </div>

              {/* LinkedIn */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-8 md:w-10 h-20 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="40%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  LinkedIn
                </span>
              </div>

              {/* Eventos */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-8 md:w-10 h-14 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="30%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  Eventos
                </span>
              </div>

              {/* Outbound */}
              <div className="flex flex-col items-center flex-1 group">
                <div className="w-8 md:w-10 h-32 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="75%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  Outbound
                </span>
              </div>

              {/* Partners */}
              <div className="flex flex-col items-center flex-1 group font-sans">
                <div className="w-8 md:w-10 h-10 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200" title="25%"></div>
                <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0">
                  Partners
                </span>
              </div>

            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono">
            * Segmentación por canales de prospección con datos ilustrativos DEMO.
          </p>
        </div>

        {/* Table: Resumen pipeline activo — Hot & Warm próximos 6 meses */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  Resumen pipeline activo — Hot &amp; Warm
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-tight">
                  próximos 6 meses
                </p>
              </div>
              <DemoBadge />
            </div>

            {/* Custom styled table as in screenshot */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2.5 text-xs font-bold text-slate-400 uppercase">Mes</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase">Hot</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase">Warm</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase">Total</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-400 uppercase">Estatus</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-semibold font-mono text-slate-950 divide-y divide-slate-100">
                  
                  {/* Row 1 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-900">Jun 2026</td>
                    <td className="py-3 text-right">$13,146</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right font-medium text-slate-900">$13,146</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] rounded-full font-bold border border-blue-100 uppercase font-sans">
                        Media
                      </span>
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-900">Jul 2026</td>
                    <td className="py-3 text-right">$221,212</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right font-medium text-slate-900">$221,212</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] rounded-full font-bold border border-red-100 uppercase font-sans">
                        Alta
                      </span>
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-900">Ago 2026</td>
                    <td className="py-3 text-right">$66,489</td>
                    <td className="py-3 text-right">$200,045</td>
                    <td className="py-3 text-right font-medium text-slate-900">$266,533</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] rounded-full font-bold border border-red-100 uppercase font-sans">
                        Alta
                      </span>
                    </td>
                  </tr>

                  {/* Row 4 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-900">Sep 2026</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right">$42,832</td>
                    <td className="py-3 text-right font-medium text-slate-900">$42,832</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] rounded-full font-bold border border-blue-100 uppercase font-sans">
                        Media
                      </span>
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-900">Oct 2026</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right">$338,752</td>
                    <td className="py-3 text-right font-medium text-slate-900">$338,752</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] rounded-full font-bold border border-red-100 uppercase font-sans">
                        Alta
                      </span>
                    </td>
                  </tr>

                  {/* Row 6 */}
                  <tr className="hover:bg-slate-50 transition duration-150">
                    <td className="py-3 font-sans font-bold text-slate-400">Nov 2026</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 text-right text-slate-350 italic font-normal">—</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] rounded-full font-medium border border-slate-200 uppercase font-sans">
                        Sin datos
                      </span>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono">
            * Valores de proyección cronológica mensual correspondientes al modelo DEMO.
          </p>
        </div>

      </div>

      {/* NEW MAP COMPONENT: MAPA DE UBICACIÓN DE PROYECTOS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase font-sans">
                MAPA DE UBICACIÓN DE PROYECTOS
              </h3>
              <DemoBadge />
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Concentración de operaciones logísticas en la zona centro y pacífico nacional.</p>
          </div>
          
          <div className="flex gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="w-2.5 h-2.5 bg-[#004ddf] rounded-full inline-block"></span> Activos
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="w-2.5 h-2.5 bg-slate-300 rounded-full inline-block"></span> En prospección
            </span>
          </div>
        </div>

        {/* Schematic styled vector/svg map representation */}
        <div className="relative w-full h-[380px] bg-slate-50 flex items-center justify-center p-6">
          {/* Grayscale background grid pattern to simulate a futuristic dashboard map */}
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#004ddf 0.5px, transparent 0.5px), radial-gradient(#004ddf 0.5px, #f8f9ff 0.5px)', backgroundSize: '10px 10px' }}></div>
          
          {/* Aesthetic vector route connections exactly as in screenshot */}
          <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
            <path d="M150,120 Q240,160 380,180 T680,240" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M380,100 Q450,180 500,260" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M220,180 Q340,320 500,260" fill="none" stroke="#004ddf" strokeWidth="0.8" strokeDasharray="3 3" />
          </svg>

          {/* Interactive mapped region hotspots */}
          {/* CDMX Spot */}
          <div className="absolute top-[65%] left-[50%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-6 w-6 rounded-full bg-[#004ddf] opacity-40 animate-ping"></span>
            <span className="relative flex rounded-full h-4 w-4 bg-[#004ddf] border-2 border-white shadow-md"></span>
            
            {/* Tooltip visible natively, matching screenshot */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-lg text-[10px] font-black whitespace-nowrap text-slate-900 flex flex-col items-center">
              <span>CDMX [28 Proyectos]</span>
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest font-mono">Principal Sede (DEMO)</span>
            </div>
          </div>

          {/* Monterrey Spot */}
          <div className="absolute top-[35%] left-[48%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-[#004ddf] border-2 border-white shadow-md"></span>
            
            {/* Tooltip on hover */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150">
              Monterrey (12 Proyectos) [DEMO]
            </div>
          </div>

          {/* Guadalajara Spot */}
          <div className="absolute top-[58%] left-[44%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-[#004ddf] border-2 border-white shadow-md"></span>
            
            {/* Tooltip on hover */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150">
              Guadalajara (8 Proyectos) [DEMO]
            </div>
          </div>

          {/* Tijuana Spot */}
          <div className="absolute top-[18%] left-[30%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-[#004ddf] border-2 border-white shadow-md"></span>
            
            {/* Tooltip on hover */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150">
              Tijuana (4 Proyectos) [DEMO]
            </div>
          </div>

          {/* Cancun Spot - (Prospección) */}
          <div className="absolute top-[72%] left-[65%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-slate-300 border-2 border-slate-200 shadow-md"></span>
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150">
              Cancún (Prospección) [DEMO]
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg text-[9px] text-slate-500 border border-slate-200 font-semibold shadow-xs z-20">
            Visualización geográfica de pipeline activo (Modelo DEMO de rediseño)
          </div>
        </div>

        {/* Footer text of reference */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-medium text-slate-400">
          <span>Soporte de multi-regiones asignado en DEMO</span>
          <span>Datos de referencia basados en pipeline real · Conectar con CRM para actualización en tiempo real</span>
        </div>
      </div>

    </div>
  );
}
