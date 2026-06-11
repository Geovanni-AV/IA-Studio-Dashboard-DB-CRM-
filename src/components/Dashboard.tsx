import React, { useState } from 'react';
import { CRMRecord, UserRole } from '../types';
import { TrendingUp, CheckCircle, BarChart2, DollarSign, Globe, Award, Layers } from 'lucide-react';

interface DashboardProps {
  records: CRMRecord[];
  exchangeRate: number;
  currentCurrency: 'USD' | 'MXN';
  role: UserRole;
  onEditRecord: (record: CRMRecord) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  records,
  exchangeRate,
  currentCurrency,
  role,
  onEditRecord,
  onNavigate
}: DashboardProps) {
  const [selectedRegion, setSelectedRegion] = useState('México e Hispanoamérica');

  // Convert helper
  const formatVal = (val: number, fallbackCurrency: 'USD' | 'MXN') => {
    let displayVal = val;
    let targetMoneda = fallbackCurrency;

    // Convert if matching the general display toggle
    if (currentCurrency !== fallbackCurrency) {
      if (currentCurrency === 'USD' && fallbackCurrency === 'MXN') {
        displayVal = val / exchangeRate;
        targetMoneda = 'USD';
      } else if (currentCurrency === 'MXN' && fallbackCurrency === 'USD') {
        displayVal = val * exchangeRate;
        targetMoneda = 'MXN';
      }
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetMoneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(displayVal);
  };

  // 1. Commercial Pipeline: Sum of Propuesta & Negociación
  const pipelineRecords = records.filter(
    (r) => r.status_proyecto === 'Propuesta' || r.status_proyecto === 'Negociación'
  );
  const pipelineTotalUSD = pipelineRecords.reduce((acc, r) => {
    let itemVal = r.total_general_cotizacion;
    if (r.informacion_general_moneda === 'MXN') {
      itemVal = r.total_general_cotizacion / exchangeRate;
    }
    return acc + itemVal;
  }, 0);

  // 2. Closed Won: Sum of 'Cerrado Ganado'
  const closedWonRecords = records.filter((r) => r.status_proyecto === 'Cerrado Ganado');
  const closedWonTotalUSD = closedWonRecords.reduce((acc, r) => {
    let itemVal = r.total_general_cotizacion;
    if (r.informacion_general_moneda === 'MXN') {
      itemVal = r.total_general_cotizacion / exchangeRate;
    }
    return acc + itemVal;
  }, 0);

  // 3. Conversion Rate
  const totalCount = records.length;
  const conversionRate = totalCount > 0 ? (closedWonRecords.length / totalCount) * 100 : 0;

  // 4. Counts & Distribution
  const usdRecords = records.filter((r) => r.informacion_general_moneda === 'USD');
  const mxnRecords = records.filter((r) => r.informacion_general_moneda === 'MXN');

  const usdSumUSD = usdRecords.reduce((acc, r) => acc + r.total_general_cotizacion, 0);
  const mxnSumMXN = mxnRecords.reduce((acc, r) => acc + r.total_general_cotizacion, 0);

  const totalUSDTranslated = usdSumUSD + (mxnSumMXN / exchangeRate);
  const usdPercentage = totalUSDTranslated > 0 ? (usdSumUSD / totalUSDTranslated) * 100 : 0;

  // Confidence meter color mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Propuesta':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Negociación':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Cerrado Ganado':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 fade-in" id="dashboard-tab-content">
      {/* Header and Welcome */}
      <div className="flex justify-between items-end pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Desempeño Comercial General
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Perspectiva en tiempo real del pipeline comercial y la distribución del presupuesto logístico.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white border border-slate-200 p-1 flex rounded-md shadow-3xs">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold text-[10px] rounded uppercase tracking-wider">
              • Datos en Tiempo Real
            </span>
          </div>
          <button
            onClick={() => onNavigate('Leads/Projects')}
            className="bg-blue-605 bg-blue-600 text-white px-4 py-2 text-xs rounded-md hover:bg-blue-700 transition-all font-bold flex items-center gap-1.5 shadow-3xs uppercase tracking-wide"
          >
            <Layers className="w-3.5 h-3.5" />
            Administrar Proyectos
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="font-label-caps text-xs text-slate-500 uppercase font-bold tracking-wider">
              Pipeline Comercial
            </p>
            <TrendingUp className="text-[#004ddf] w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold font-data-mono text-[#0b1c30]">
              {formatVal(pipelineTotalUSD, 'USD')}
            </p>
            <span className="text-xs font-bold text-[#10B981]">+12.4%</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Proyectos en Propuesta o Negociación
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="font-label-caps text-xs text-slate-500 uppercase font-bold tracking-wider">
              Monto Cerrado Ganado
            </p>
            <CheckCircle className="text-[#10B981] w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold font-data-mono text-[#0b1c30]">
              {formatVal(closedWonTotalUSD, 'USD')}
            </p>
            <span className="text-xs font-bold text-[#10B981]">+8.1%</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {closedWonRecords.length} ofertas formales con Orden de Compra
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="font-label-caps text-xs text-slate-500 uppercase font-bold tracking-wider">
              Tasa de Conversión
            </p>
            <BarChart2 className="text-[#10B981] w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold font-data-mono text-[#0b1c30]">
              {conversionRate.toFixed(1)}%
            </p>
            <span className="text-xs font-bold text-slate-400">Promedio</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Índice de éxito en cierre de contratos
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="font-label-caps text-xs text-slate-500 uppercase font-bold tracking-wider">
              Total de Contratos
            </p>
            <DollarSign className="text-[#F59E0B] w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold font-data-mono text-[#0b1c30]">
              {totalCount} Folios
            </p>
            <span className="text-xs font-bold text-[#10B981]">Activos</span>
          </div>
          <div className="text-xs text-slate-500 font-medium font-sans">
            Trazabilidad B2B integrada en México
          </div>
        </div>
      </div>

      {/* Main Grid: Pipeline Table + Currency Mix */}
      <div className="grid grid-cols-12 gap-5">
        {/* Pipeline traffic table */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-base font-semibold font-title-sm text-[#0b1c30]">
              Tráfico de Pipeline Comercial
            </h2>
            <div className="flex gap-3 text-xs text-[#45464d]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Propuesta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Negociación
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Cerrado Ganado
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8fafc] border-b border-slate-200">
                <tr>
                  <th className="p-3 px-4 font-label-caps text-xs text-slate-500 uppercase">Proyecto</th>
                  <th className="p-3 px-4 font-label-caps text-xs text-slate-500 uppercase">Corporativo</th>
                  <th className="p-3 px-4 font-label-caps text-xs text-slate-500 text-right uppercase">Monto Total</th>
                  <th className="p-3 px-4 font-label-caps text-xs text-slate-500 uppercase">Estado</th>
                  <th className="p-3 px-4 font-label-caps text-xs text-slate-500 uppercase">Trazabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onEditRecord(r)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="p-3 px-4 font-semibold text-[#0b1c30] max-w-[200px] truncate">
                      {r.informacion_general_proyecto}
                    </td>
                    <td className="p-3 px-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">
                          {r.informacion_general_cliente.substring(0, 3)}
                        </span>
                        <span>{r.informacion_general_cliente}</span>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-right font-data-mono font-bold text-[#0b1c30]">
                      {formatVal(r.total_general_cotizacion, r.informacion_general_moneda)}
                    </td>
                    <td className="p-3 px-4">
                      <span className={`inline-block px-2 text-[10px] font-bold py-0.5 rounded-full border ${getStatusBadge(r.status_proyecto)}`}>
                        {r.status_proyecto}
                      </span>
                    </td>
                    <td className="p-3 px-4 text-xs font-data-mono text-blue-600 font-bold">
                      {r.informacion_general_folio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Currency & Portfolio distribution block */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-sm p-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-base font-semibold font-title-sm text-[#0b1c30]">
              Distribución de Monedas
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Mix financiero cotizado en divisas.</p>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
            <div className="w-40 h-40 rounded-full border-[14px] border-[#004ddf] relative flex items-center justify-center">
              <div className="absolute inset-[-14px] rounded-full border-[14px] border-[#3B82F6] border-l-transparent border-b-transparent border-r-transparent transform rotate-12"></div>
              <div className="absolute inset-[-14px] rounded-full border-[14px] border-slate-200 border-t-transparent border-l-transparent border-b-transparent transform -rotate-45"></div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">USD Dominance</p>
                <p className="text-2xl font-bold font-data-mono text-[#0b1c30]">{usdPercentage.toFixed(0)}%</p>
              </div>
            </div>

            <div className="w-full mt-6 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#004ddf] rounded-xs inline-block"></span>
                  <span>United States Dollar (USD)</span>
                </div>
                <span className="font-data-mono font-bold text-[#0b1c30]">
                  ${usdSumUSD.toLocaleString('en-US', { minimumFractionDigits: 0 })} USD
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#3B82F6] rounded-xs inline-block"></span>
                  <span>Mexican Peso (MXN)</span>
                </div>
                <span className="font-data-mono font-bold text-[#0b1c30]">
                  ${mxnSumMXN.toLocaleString('en-US', { minimumFractionDigits: 0 })} MXN
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map & Geographics Concentration */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-base font-semibold font-title-sm text-[#0b1c30]">
              Distribución Geográfica y Concentración
            </h2>
            <p className="text-xs text-slate-500">Porcentaje y densidad de proyectos distribuidos a nivel internacional.</p>
          </div>
          <div>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="text-xs border-slate-200 bg-white py-1 px-2.5 rounded-md focus:ring-[#004ddf] outline-none"
            >
              <option value="México e Hispanoamérica">México e Hispanoamérica</option>
              <option value="Norteamérica">Norteamérica &amp; EE.UU.</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Visual Interactive Map Representation */}
          <div className="lg:col-span-2 bg-[#f8f9ff] h-[280px] p-6 relative flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
              <Globe className="w-72 h-72 text-slate-400" />
            </div>

            {/* Simulated Hotspots representing Bimbo, AstraZeneca, UNAM */}
            {/* CDMX Spot */}
            <div className="absolute top-[50%] left-[45%] group cursor-default">
              <span className="absolute inline-flex h-3 w-3 rounded-full bg-[#004ddf] opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#004ddf]"></span>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-white text-[10px] p-1.5 rounded shadow-lg whitespace-nowrap opacity-90">
                <p className="font-bold">CDMX / Centro</p>
                <p className="font-mono">UNAM &amp; Bimbo</p>
              </div>
            </div>

            {/* Guadalajara JAL Spot */}
            <div className="absolute top-[55%] left-[32%] group cursor-default">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#3B82F6] border border-white"></span>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-white text-[10px] p-1.5 rounded shadow-lg whitespace-nowrap opacity-90 hidden group-hover:block">
                <p className="font-bold">Guadalajara (JAL)</p>
                <p className="font-mono">AstraZeneca</p>
              </div>
            </div>

            {/* EE.UU. Detroit / Silao Corridor */}
            <div className="absolute top-[25%] left-[60%] group cursor-default">
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#F59E0B] border border-white"></span>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-white text-[10px] p-1.5 rounded shadow-lg whitespace-nowrap opacity-90">
                <p className="font-bold">Silao Corridor / Detroit</p>
                <p className="font-mono">GM &amp; EE.UU.</p>
              </div>
            </div>

            <div className="z-10 mt-auto flex gap-3">
              <div className="bg-white px-3 py-1.5 border border-slate-200 rounded shadow-xs text-xs">
                <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Top Región</p>
                <p className="font-bold">Centro de México</p>
              </div>
              <div className="bg-white px-3 py-1.5 border border-slate-200 rounded shadow-xs text-xs">
                <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tasa Crecimiento</p>
                <p className="font-bold text-[#10B981]">LATAM (+15.4%)</p>
              </div>
            </div>
          </div>

          {/* Regional Progress Statistics */}
          <div className="border-t lg:border-t-0 lg:border-l border-slate-200 p-5 space-y-4">
            <h3 className="font-label-caps text-xs text-slate-500 font-bold uppercase tracking-wider">
              Densidad por Centro Logístico
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700">México (CDMX / Toluca)</span>
                  <span className="font-data-mono font-bold">58%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-xs overflow-hidden">
                  <div className="bg-[#004ddf] h-full rounded-xs" style={{ width: '58%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700">Jalisco (Guadalajara)</span>
                  <span className="font-data-mono font-bold">22%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-xs overflow-hidden">
                  <div className="bg-[#3B82F6] h-full rounded-xs" style={{ width: '22%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700">Guanajuato (Silao)</span>
                  <span className="font-data-mono font-bold">14%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-xs overflow-hidden">
                  <div className="bg-[#F59E0B] h-full rounded-xs" style={{ width: '14%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700">EE.UU. / LATAM Externo</span>
                  <span className="font-data-mono font-bold">6%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-xs overflow-hidden">
                  <div className="bg-slate-300 h-full rounded-xs" style={{ width: '6%' }}></div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-[#eff4ff] text-[#004ddf] rounded flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cumplimiento B2B</p>
                <p className="text-xs font-semibold text-slate-700">Consola optimizada para el mercado nacional</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
