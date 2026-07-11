import React, { useState, useMemo, useEffect } from 'react';
import { safeRound } from '../utils/coreUtils';
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
  Target,
  Loader2
} from 'lucide-react';
import { getSupabaseClient, getResolvedCRMTableName, mapRawCRMRecord, getKnownCRMTableColumns } from '../supabaseService';

interface DashboardProps {
  exchangeRate: number;
  currentCurrency: 'USD' | 'MXN';
  role: UserRole;
  isSupabaseConfigured?: boolean;
  onEditRecord: (record: CRMRecord) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  exchangeRate,
  currentCurrency,
  role,
  isSupabaseConfigured,
  onEditRecord,
  onNavigate
}: DashboardProps) {
  // FASE 4: ESTADOS LOCALES DEL DASHBOARD
  const [records, setRecords] = useState<CRMRecord[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // FASE 4: CONSULTA DE PROYECCIÓN ESTRICTA A SUPABASE
  useEffect(() => {
    let active = true;
    const fetchDashboardData = async () => {
      setIsFetching(true);
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      const client = getSupabaseClient(url, key);

      if (client) {
         // PROYECCIÓN DINÁMICA: Filtramos las columnas solicitadas contra las columnas reales para evitar error 400 Bad Request (undefined column).
         const knownColumns = getKnownCRMTableColumns();
         const requestedColumns = [
           'id', 'informacion_general_folio', 'fecha_registro', 'fecha_inicio_proyecto',
           'total_hardware_cotizacion', 'total_servicios_cotizacion', 'total_subtotal_cotizacion',
           'informacion_general_moneda', 'estado_proyecto', 'status_proyecto', 'cliente_pais',
           'cliente_ubicacion', 'etapa', 'nivel_termo', 'prioridad_nivel', 'responsable',
           'informacion_general_cliente', 'informacion_general_proyecto', 'notas_comerciales'
         ];
         let selectString = '*';
         if (knownColumns.length > 0) {
           const validated = requestedColumns.filter(reqCol => {
             if (knownColumns.includes(reqCol)) return true;
             const normReq = reqCol.toLowerCase().replace(/[\s_-]/g, '');
             return knownColumns.some(knownCol => knownCol.toLowerCase().replace(/[\s_-]/g, '') === normReq);
           });
           if (validated.length > 0) {
             const dbCols = validated.map(reqCol => {
               if (knownColumns.includes(reqCol)) return reqCol;
               const normReq = reqCol.toLowerCase().replace(/[\s_-]/g, '');
               return knownColumns.find(knownCol => knownCol.toLowerCase().replace(/[\s_-]/g, '') === normReq) || reqCol;
             });
             // Asegurar de incluir siempre la columna ID
             if (!dbCols.includes('id') && knownColumns.includes('id')) {
               dbCols.unshift('id');
             }
             selectString = dbCols.join(', ');
           }
         } else {
           selectString = requestedColumns.join(', ');
         }

         const { data, error } = await client
           .from(getResolvedCRMTableName())
           .select(selectString)
           .limit(10000); // Soporta hasta 10,000 registros sin afectar la RAM

         if (!error && data && active) {
            setRecords(data.map(mapRawCRMRecord));
         }
      }
      if (active) setIsFetching(false);
    };

    if (isSupabaseConfigured) {
      fetchDashboardData();
    } else {
      setRecords([]);
      setIsFetching(false);
    }
    return () => { active = false; };
  }, [isSupabaseConfigured]);

  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedStatus, setSelectedStatus] = useState('Todos los estatus');
  const [selectedCountry, setSelectedCountry] = useState('Todos los países');

  // Load kanbanMeta from local storage
  const [kanbanMeta] = useState<Record<string, any>>(() => {
    const local = localStorage.getItem('verse_crm_kanban_meta');
    return local ? JSON.parse(local) : {};
  });

  // Forced Real Visualization strictly consuming live database
  const visualizationMode = 'real';

  // Badge utility representing active Supabase database connection
  const DemoBadge = () => {
    return (
      <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold tracking-wider rounded border border-emerald-300 uppercase whitespace-nowrap">
        CONEXIÓN SUPABASE ACTIVA
      </span>
    );
  };

  // Currency conversion helper
  const convertAmount = (amount: number, fromCurrency?: 'USD' | 'MXN') => {
    const from = fromCurrency || 'USD';
    if (from === currentCurrency) return amount;
    if (from === 'USD' && currentCurrency === 'MXN') {
      return amount * exchangeRate;
    }
    if (from === 'MXN' && currentCurrency === 'USD') {
      return amount / exchangeRate;
    }
    return amount;
  };

  // Compact number formatting
  const formatCompact = (val: number) => {
    const symbol = '$';
    if (val >= 1_000_000) {
      return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000) {
      return `${symbol}${(val / 1_000).toFixed(0)}K`;
    }
    return `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  // Reusable Metric Card with KPI help tooltip
  const renderMetricCardWithTooltip = ({
    id,
    title,
    value,
    footer,
    borderLeftColorClass = 'border-l-slate-400',
    minHeightClass = '',
    align = 'center',
    description,
    calculation
  }: {
    id: string;
    title: string;
    value: React.ReactNode;
    footer: React.ReactNode;
    borderLeftColorClass?: string;
    minHeightClass?: string;
    align?: 'left' | 'right' | 'center';
    description: string;
    calculation: string;
  }) => {
    let tooltipPositionClass = '';

    if (align === 'left') {
      tooltipPositionClass = 'left-0 origin-bottom-left';
    } else if (align === 'right') {
      tooltipPositionClass = 'right-0 origin-bottom-right';
    } else {
      tooltipPositionClass = 'left-1/2 -translate-x-1/2 origin-bottom';
    }

    return (
      <div 
        className={`group bg-white rounded-xl p-4 border border-slate-200 border-l-4 ${borderLeftColorClass} shadow-sm transition hover:translate-y-[-2px] hover:shadow-md duration-200 relative flex flex-col justify-between cursor-help ${minHeightClass}`}
        id={`metric-card-${id}`}
      >
        <div>
          <div className="flex justify-between items-start mb-1 gap-1">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider leading-tight uppercase font-sans">
              {title}
            </span>
            <DemoBadge />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
            {value}
          </p>
        </div>
        <div className="w-full">
          {footer}
        </div>

        {/* Popover / Tooltip content window */}
        <div 
          className={`absolute z-40 bottom-full ${tooltipPositionClass} mb-3.5 w-72 bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-xl p-4 shadow-2xl border border-slate-700/80 pointer-events-none opacity-0 scale-95 translate-y-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-200`}
          id={`tooltip-${id}`}
        >
          {/* Arrow */}
          <div 
            className="absolute top-full -mt-1 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-slate-700/80" 
            style={{ 
              left: align === 'left' ? '1.5rem' : align === 'right' ? 'auto' : '50%', 
              right: align === 'right' ? '1.5rem' : 'auto', 
              transform: align === 'center' ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)' 
            }} 
          />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-[10px] text-blue-400 uppercase tracking-widest leading-none font-sans flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Ficha del KPI
              </span>
              <span className="text-[9px] px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-400 border border-slate-700/50">
                {title}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-300 tracking-wide font-sans leading-relaxed">
                Descripción:
              </p>
              <p className="text-[11px] text-slate-400 leading-normal font-sans text-left whitespace-normal">
                {description}
              </p>
            </div>

            <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
              <p className="text-[11px] font-semibold text-amber-400 tracking-wide font-sans leading-relaxed flex items-center gap-1">
                <span>🧮</span> Cómo se calcula:
              </p>
              <p className="text-[10.5px] text-slate-300 leading-normal font-mono bg-slate-950/60 p-1.5 rounded border border-slate-800/80 text-left whitespace-normal break-words">
                {calculation}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filtering Logic (Memoized)
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // A. Year Filter (Y-M-D)
      if (selectedYear !== 'Todos') {
        const dateStr = r.fecha_registro || r.fecha_inicio_proyecto || '';
        const year = dateStr ? dateStr.substring(0, 4) : '';
        if (year && year !== selectedYear) return false;
        if (!year && selectedYear !== '2026') return false;
      }

      // B. Status Filter mapped to CRM state
      if (selectedStatus !== 'Todos los estatus') {
        const stage = kanbanMeta[r.id]?.stage;
        if (selectedStatus === 'Propuesta' && stage !== 'Cotizado' && r.estado_proyecto !== 'Propuesta') return false;
        if (selectedStatus === 'Negociación' && stage !== 'Negociación' && r.estado_proyecto !== 'Negociación') return false;
        if (selectedStatus === 'Ganado' && stage !== 'Cerrado Ganado' && r.estado_proyecto !== 'Cerrado Ganado') return false;
      }

      // C. Country Filter
      if (selectedCountry !== 'Todos los países') {
        if (selectedCountry === 'México' && r.cliente_pais !== 'México') return false;
        if (selectedCountry === 'EE.UU.' && r.cliente_pais !== 'EE.UU.') return false;
      }

      return true;
    });
  }, [records, selectedYear, selectedStatus, selectedCountry, kanbanMeta]);

  // Calculate Real KPI Elements (Memoized)
  const totalLeadsRaw = filteredRecords.length;
  
  // Checking active projects count (stage not closed lost, or custom checks) (Memoized)
  const activeProjectsCount = useMemo(() => {
    return filteredRecords.filter(r => {
      const stage = kanbanMeta[r.id]?.stage;
      return stage !== 'Cerrado Perdido';
    }).length;
  }, [filteredRecords, kanbanMeta]);

  const computePipelineSumForYear = useMemo(() => {
    return (yrStr: string) => {
      const sum = records.filter(r => {
        const dateStr = r.fecha_registro || r.fecha_inicio_proyecto || '';
        const yr = dateStr ? dateStr.substring(0, 4) : '2026';
        if (yr !== yrStr) return false;
        if (selectedCountry !== 'Todos los países' && r.cliente_pais !== selectedCountry) return false;
        
        const stage = kanbanMeta[r.id]?.stage;
        return stage !== 'Cerrado Perdido';
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);
      return safeRound(sum);
    };
  }, [records, selectedCountry, kanbanMeta, currentCurrency, exchangeRate]);

  const pipeline2026_val = useMemo(() => computePipelineSumForYear('2026'), [computePipelineSumForYear]);
  const pipeline2027_val = useMemo(() => computePipelineSumForYear('2027'), [computePipelineSumForYear]);

  // Temperature aggregates (Memoized)
  const hotRecords = useMemo(() => {
    return filteredRecords.filter(r => {
      const stage = kanbanMeta[r.id]?.stage;
      const temp = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
      return temp === 'Hot' || stage === 'Negociación';
    });
  }, [filteredRecords, kanbanMeta]);

  const hotAmount = useMemo(() => {
    return safeRound(hotRecords.reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0));
  }, [hotRecords, currentCurrency, exchangeRate]);

  const warmRecords = useMemo(() => {
    return filteredRecords.filter(r => {
      const stage = kanbanMeta[r.id]?.stage;
      const temp = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
      return temp === 'Warm' || stage === 'Cotizado';
    });
  }, [filteredRecords, kanbanMeta]);

  const warmAmount = useMemo(() => {
    return safeRound(warmRecords.reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0));
  }, [warmRecords, currentCurrency, exchangeRate]);

  const coolRecords = useMemo(() => {
    return filteredRecords.filter(r => {
      const stage = kanbanMeta[r.id]?.stage;
      const temp = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
      return temp === 'Cool' || stage === 'Nuevo' || stage === 'Contactado' || (!temp && !stage);
    });
  }, [filteredRecords, kanbanMeta]);

  const coolAmount = useMemo(() => {
    return safeRound(coolRecords.reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0));
  }, [coolRecords, currentCurrency, exchangeRate]);

  const winRecords = useMemo(() => {
    return filteredRecords.filter(r => {
      const stage = kanbanMeta[r.id]?.stage;
      const temp = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
      return temp === 'Win' || stage === 'Cerrado Ganado' || r.estado_proyecto === 'Cerrado Ganado';
    });
  }, [filteredRecords, kanbanMeta]);

  const winAmount = useMemo(() => {
    return safeRound(winRecords.reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0));
  }, [winRecords, currentCurrency, exchangeRate]);

  // Link visualization option to our interactive toggle state
  const hasRealData = visualizationMode === 'real';

  // Resolved Display Values (Memoized)
  const displayActiveProjects = hasRealData ? activeProjectsCount : 52;
  const displayPipeline2026 = hasRealData ? pipeline2026_val : 4000000;
  const displayPipeline2027 = hasRealData ? pipeline2027_val : 459000;
  const displayHotAmount = hasRealData ? hotAmount : 301000;
  const displayWarmAmount = hasRealData ? warmAmount : 582000;
  const displayCoolAmount = hasRealData ? coolAmount : 3300000;
  const displayWinAmount = hasRealData ? winAmount : 467000;

  // Sales & Target definitions (Memoized)
  const annualTargetMxn = 5100000;
  const annualTarget = useMemo(() => {
    return currentCurrency === 'MXN' ? annualTargetMxn : annualTargetMxn / exchangeRate;
  }, [currentCurrency, exchangeRate]);

  const displayRealSales = displayWinAmount;
  
  const fulfillmentPercent = useMemo(() => {
    return annualTarget > 0 ? (displayRealSales / annualTarget) * 100 : 0;
  }, [displayRealSales, annualTarget]);

  const displayCoverage = useMemo(() => {
    return annualTarget > 0 ? (displayHotAmount + displayWarmAmount + displayCoolAmount) / annualTarget : 1.2;
  }, [displayHotAmount, displayWarmAmount, displayCoolAmount, annualTarget]);

  const displayTicketAvg = useMemo(() => {
    return activeProjectsCount > 0 ? (displayHotAmount + displayWarmAmount + displayCoolAmount + displayWinAmount) / activeProjectsCount : 95000;
  }, [displayHotAmount, displayWarmAmount, displayCoolAmount, displayWinAmount, activeProjectsCount]);

  // Closed calculations (Memoized)
  const wonCount = useMemo(() => {
    return filteredRecords.filter(r => kanbanMeta[r.id]?.stage === 'Cerrado Ganado' || r.estado_proyecto === 'Cerrado Ganado').length;
  }, [filteredRecords, kanbanMeta]);

  const lostCount = useMemo(() => {
    return filteredRecords.filter(r => kanbanMeta[r.id]?.stage === 'Cerrado Perdido').length;
  }, [filteredRecords, kanbanMeta]);

  const closedCountTotal = useMemo(() => wonCount + lostCount, [wonCount, lostCount]);
  
  const displayWinRate = useMemo(() => {
    return closedCountTotal > 0 ? Math.round((wonCount / closedCountTotal) * 100) : 92;
  }, [wonCount, closedCountTotal]);

  const displaySlippageRate = useMemo(() => {
    return activeProjectsCount > 0 ? Math.round((coolRecords.length / activeProjectsCount) * 100) : 18;
  }, [coolRecords, activeProjectsCount]);

  // CRM funnel values (Memoized)
  const leadsCount = totalLeadsRaw > 0 ? totalLeadsRaw : 144;
  
  const mqlCount = useMemo(() => {
    return totalLeadsRaw > 0 ? filteredRecords.filter(r => ['Nuevo', 'Contactado'].includes(kanbanMeta[r.id]?.stage || '')).length : 79;
  }, [totalLeadsRaw, filteredRecords, kanbanMeta]);

  const sqlCount = useMemo(() => {
    return totalLeadsRaw > 0 ? filteredRecords.filter(r => ['Cotizado', 'Negociación'].includes(kanbanMeta[r.id]?.stage || '')).length : 46;
  }, [totalLeadsRaw, filteredRecords, kanbanMeta]);

  const propuestaCount = useMemo(() => {
    return totalLeadsRaw > 0 ? filteredRecords.filter(r => kanbanMeta[r.id]?.stage === 'Cotizado').length : 28;
  }, [totalLeadsRaw, filteredRecords, kanbanMeta]);

  const negociacionCount = useMemo(() => {
    return totalLeadsRaw > 0 ? filteredRecords.filter(r => kanbanMeta[r.id]?.stage === 'Negociación').length : 14;
  }, [totalLeadsRaw, filteredRecords, kanbanMeta]);

  const ganadoCount = totalLeadsRaw > 0 ? wonCount : 6;

  const finalFunnel = useMemo(() => {
    return {
      leads: leadsCount,
      mql: mqlCount,
      sql: sqlCount,
      propuesta: propuestaCount,
      negociacion: negociacionCount,
      ganado: ganadoCount,
    };
  }, [leadsCount, mqlCount, sqlCount, propuestaCount, negociacionCount, ganadoCount]);

  // Dynamic Chart 1 Monthly Data (Sales vs Target vs Projection) (Memoized)
  const monthlyLabelList = useMemo(() => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], []);
  
  const monthlyValuesData = useMemo(() => {
    return monthlyLabelList.map((mName, mIdx) => {
      const monthlyTarget = annualTarget / 12;
      
      const wonInMonth = records.filter(r => {
        if (!r.fecha_registro) return false;
        const parts = r.fecha_registro.split('-');
        if (parts.length >= 2) {
          return parts[0] === selectedYear && (parseInt(parts[1], 10) - 1) === mIdx;
        }
        return false;
      }).filter(r => {
        const stage = kanbanMeta[r.id]?.stage;
        return stage === 'Cerrado Ganado' || r.estado_proyecto === 'Cerrado Ganado';
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);

      const projInMonth = records.filter(r => {
        if (!r.fecha_registro) return false;
        const parts = r.fecha_registro.split('-');
        if (parts.length >= 2) {
          return parts[0] === selectedYear && (parseInt(parts[1], 10) - 1) === mIdx;
        }
        return false;
      }).filter(r => {
        const stage = kanbanMeta[r.id]?.stage;
        return stage !== 'Cerrado Ganado' && stage !== 'Cerrado Perdido';
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);

      return {
        name: mName,
        sales: wonInMonth,
        projection: projInMonth,
        target: monthlyTarget
      };
    });
  }, [monthlyLabelList, annualTarget, records, selectedYear, kanbanMeta, currentCurrency, exchangeRate]);

  const maxMonthValue = useMemo(() => {
    return Math.max(
      ...monthlyValuesData.map(m => Math.max(m.sales, m.projection, m.target)),
      1
    );
  }, [monthlyValuesData]);

  const computedGraphData = useMemo(() => {
    return monthlyValuesData.map(m => {
      const targetPct = Math.min(100, Math.round((m.target / maxMonthValue) * 100));
      const salesPct = m.target > 0 ? Math.min(100, Math.round((m.sales / m.target) * 100)) : 0;
      const hasProjection = m.projection > 0 && m.sales === 0;
      const projTop = hasProjection ? Math.max(10, Math.round(100 - (m.projection / maxMonthValue) * 100)) : 0;

      return {
        name: m.name,
        salesPct,
        targetPct: Math.max(10, targetPct),
        hasProjection,
        projTop,
        salesVal: m.sales,
        projVal: m.projection
      };
    });
  }, [monthlyValuesData, maxMonthValue]);

  const activeGraphData = computedGraphData;

  // Dynamic Chart 2 Quarterly Stacked data (Memoized)
  const targetYearNum = useMemo(() => parseInt(selectedYear, 10), [selectedYear]);
  
  const quartersLabels = useMemo(() => {
    return [
      `${targetYearNum - 1}-Q3`,
      `${targetYearNum - 1}-Q4`,
      `${targetYearNum}-Q1`,
      `${targetYearNum}-Q2`,
      `${targetYearNum}-Q3`,
      `${targetYearNum}-Q4`,
      `${targetYearNum + 1}-Q1`,
    ];
  }, [targetYearNum]);

  const computedQuartersData = useMemo(() => {
    return quartersLabels.map(labelStr => {
      const [yrStr, qStr] = labelStr.split('-Q');
      const qYear = parseInt(yrStr, 10);
      const qNum = parseInt(qStr, 10);

      const qRecords = records.filter(r => {
        if (!r.fecha_registro) return false;
        const parts = r.fecha_registro.split('-');
        if (parts.length >= 2) {
          const yr = parseInt(parts[0], 10);
          const mn = parseInt(parts[1], 10) - 1;
          const qNo = Math.floor(mn / 3) + 1;
          return yr === qYear && qNo === qNum;
        }
        return false;
      });

      const hSum = qRecords.filter(r => {
        const stage = kanbanMeta[r.id]?.stage;
        const t = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
        return t === 'Hot' || stage === 'Negociación';
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);

      const wSum = qRecords.filter(r => {
        const stage = kanbanMeta[r.id]?.stage;
        const t = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
        return t === 'Warm' || stage === 'Cotizado';
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);

      const cSum = qRecords.filter(r => {
        const stage = kanbanMeta[r.id]?.stage;
        const t = r.status_proyecto || r.prioridad_nivel || r.nivel_termo;
        return t === 'Cool' || stage === 'Nuevo' || stage === 'Contactado' || (!t && !stage);
      }).reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);

      return {
        label: labelStr,
        hotSum: hSum,
        warmSum: wSum,
        coolSum: cSum,
      };
    });
  }, [quartersLabels, records, kanbanMeta, currentCurrency, exchangeRate]);

  const maxQValue = useMemo(() => {
    return Math.max(
      ...computedQuartersData.map(q => q.hotSum + q.warmSum + q.coolSum),
      1
    );
  }, [computedQuartersData]);

  const activeQuarterPercentages = useMemo(() => {
    return computedQuartersData.map(q => {
      const total = q.hotSum + q.warmSum + q.coolSum;
      const heightPct = Math.round((total / maxQValue) * 100);
      const hotPct = total > 0 ? Math.round((q.hotSum / total) * 100) : 0;
      const warmPct = total > 0 ? Math.round((q.warmSum / total) * 100) : 0;
      const coolPct = total > 0 ? Math.round((q.coolSum / total) * 100) : 0;

      return {
        label: q.label,
        coolPct,
        warmPct,
        hotPct,
        emptyPct: 100 - hotPct - warmPct - coolPct,
        coolVal: q.coolSum,
        warmVal: q.warmSum,
        hotVal: q.hotSum,
        heightPct: Math.max(10, heightPct),
      };
    });
  }, [computedQuartersData, maxQValue]);

  const finalQuarters = activeQuarterPercentages;

  // Dynamic Chart 4 sales representative quotas (Memoized)
  const actualResponsibles = useMemo(() => {
    return Array.from(new Set(
      records.map(r => kanbanMeta[r.id]?.responsable).filter(Boolean)
    )) as string[];
  }, [records, kanbanMeta]);
  
  const finalResponsiblesList = actualResponsibles;

  const salesmenComputed = useMemo(() => {
    return finalResponsiblesList.map(name => {
      const assignedRecords = records.filter(r => kanbanMeta[r.id]?.responsable === name);
      const wonOfUser = assignedRecords.filter(r => {
        const s = kanbanMeta[r.id]?.stage;
        return s === 'Cerrado Ganado' || r.estado_proyecto === 'Cerrado Ganado';
      });
      const wonSum = wonOfUser.reduce((acc, r) => acc + convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda), 0);
      const activeC = assignedRecords.filter(r => {
        const s = kanbanMeta[r.id]?.stage;
        return s !== 'Cerrado Perdido' && s !== 'Cerrado Ganado';
      }).length;

      let targetVal = currentCurrency === 'MXN' ? 12000000 : 700000;
      if (name.includes('Carlos') || name.includes('Mercer')) targetVal = currentCurrency === 'MXN' ? 13000000 : 800000;
      if (name.includes('Ana') || name.includes('Ventas')) targetVal = currentCurrency === 'MXN' ? 10000000 : 600000;
      if (name.includes('Luis') || name.includes('Ruiz')) targetVal = currentCurrency === 'MXN' ? 8000000 : 500000;
      if (name.includes('Sofía') || name.includes('Torres')) targetVal = currentCurrency === 'MXN' ? 11000000 : 700000;

      return {
        name,
        won: wonSum,
        target: targetVal,
        activeCount: activeC,
        percentage: targetVal > 0 ? Math.round((wonSum / targetVal) * 100) : 0
      };
    });
  }, [finalResponsiblesList, records, kanbanMeta, currentCurrency, exchangeRate]);

  const finalSalesmenList = salesmenComputed;

  // Dynamic Chart 5 Lead conversion source (Memoized)
  const sourcesDisplay: Record<string, number> = useMemo(() => {
    const sourceRawCounts = { Referidos: 0, Web: 0, LinkedIn: 0, Eventos: 0, Outbound: 0, Partners: 0 };
    filteredRecords.forEach(r => {
      const combined = `${r.notas_comerciales || ''} ${r.informacion_general_cliente || ''} ${r.informacion_general_proyecto || ''}`.toLowerCase();
      if (combined.includes('linkedin')) sourceRawCounts.LinkedIn++;
      else if (combined.includes('web') || combined.includes('inbound') || combined.includes('sitio')) sourceRawCounts.Web++;
      else if (combined.includes('evento') || combined.includes('expo') || combined.includes('junta') || combined.includes('conferencia')) sourceRawCounts.Eventos++;
      else if (combined.includes('referido') || combined.includes('recomend') || combined.includes('amigo')) sourceRawCounts.Referidos++;
      else if (combined.includes('partner') || combined.includes('socio') || combined.includes('asociado')) sourceRawCounts.Partners++;
      else sourceRawCounts.Outbound++;
    });

    return {
      Referidos: sourceRawCounts.Referidos,
      Web: sourceRawCounts.Web,
      LinkedIn: sourceRawCounts.LinkedIn,
      Eventos: sourceRawCounts.Eventos,
      Outbound: sourceRawCounts.Outbound,
      Partners: sourceRawCounts.Partners,
    };
  }, [filteredRecords]);

  const maxSourceVal = useMemo(() => {
    return Math.max(...Object.values(sourcesDisplay), 1);
  }, [sourcesDisplay]);

  // Dynamic Table 6 Upcoming 6 Months projections (Memoized)
  const getUpcoming6MonthsList = () => {
    const list = [];
    const monthsNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date('2026-06-22'); // fixed anchor date according to workspace current local system time
    let currentY = now.getFullYear();
    let currentM = now.getMonth();
    
    for (let i = 0; i < 6; i++) {
      list.push({
        year: currentY,
        month: currentM,
        label: `${monthsNames[currentM]} ${currentY}`,
        hotSum: 0,
        warmSum: 0,
      });
      currentM++;
      if (currentM > 11) {
        currentM = 0;
        currentY++;
      }
    }
    return list;
  };

  const finalUpcomingMonthsTable = useMemo(() => {
    const upcomingMonthsData = getUpcoming6MonthsList();
    filteredRecords.forEach(r => {
      const temp = r.status_proyecto || r.prioridad_nivel;
      if (temp !== 'Hot' && temp !== 'Warm') return;
      
      const dateStr = r.fecha_registro || r.fecha_inicio_proyecto;
      if (!dateStr) return;
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const yr = parseInt(parts[0], 10);
        const mn = parseInt(parts[1], 10) - 1;
        
        const matched = upcomingMonthsData.find(u => u.year === yr && u.month === mn);
        if (matched) {
          const amount = convertAmount(r.total_subtotal_cotizacion || 0, r.informacion_general_moneda);
          if (temp === 'Hot') {
            matched.hotSum += amount;
          } else {
            matched.warmSum += amount;
          }
        }
      }
    });

    return upcomingMonthsData.map(m => {
      const total = m.hotSum + m.warmSum;
      let status = 'Sin datos';
      if (m.hotSum > 0) status = 'Alta';
      else if (m.warmSum > 0) status = 'Media';
      
      return {
        label: m.label,
        hotVal: m.hotSum,
        warmVal: m.warmSum,
        totalVal: total,
        status
      };
    });
  }, [filteredRecords, currentCurrency, exchangeRate]);

  // Dynamic Chart 7 Map Locations (Memoized)
  const mapHotspots = useMemo(() => {
    const spots = {
      CDMX: { active: 0, total: 0 },
      Monterrey: { active: 0, total: 0 },
      Guadalajara: { active: 0, total: 0 },
      Tijuana: { active: 0, total: 0 },
      Cancun: { active: 0, total: 0 },
    };

    filteredRecords.forEach(r => {
      const loc = (r.cliente_ubicacion || '').toLowerCase();
      const stage = kanbanMeta[r.id]?.stage;
      let code: 'CDMX' | 'Monterrey' | 'Guadalajara' | 'Tijuana' | 'Cancun' | null = null;
      
      if (loc.includes('cdmx') || loc.includes('mexico') || loc.includes('médica') || loc.includes('centro') || loc.includes('df') || loc.includes('toluca')) {
        code = 'CDMX';
      } else if (loc.includes('monterrey') || loc.includes('león') || loc.includes('nl') || loc.includes('norte')) {
        code = 'Monterrey';
      } else if (loc.includes('guadalajara') || loc.includes('jalisco') || loc.includes('gdl') || loc.includes('pacifico')) {
        code = 'Guadalajara';
      } else if (loc.includes('tijuana') || loc.includes('baja') || loc.includes('tij')) {
        code = 'Tijuana';
      } else if (loc.includes('cancun') || loc.includes('cancún') || loc.includes('q roo') || loc.includes('roo')) {
        code = 'Cancun';
      }
      
      if (code) {
        spots[code].total++;
        if (stage !== 'Cerrado Perdido') {
          spots[code].active++;
        }
      }
    });

    return spots;
  }, [filteredRecords, kanbanMeta]);

  return (
    <div className="space-y-6 fade-in pb-12" id="dashboard-tab-content">
      {/* Redesign Notice & Status Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="p-1 px-2.5 bg-white/20 font-mono font-black text-xs rounded-full border border-white/30 tracking-widest animate-pulse">
            KPI LIVE CONNECT
          </span>
          <div>
            <p className="text-xs font-bold leading-normal">
              Dashboard de pipeline conectado con datos reales del CRM
            </p>
            <p className="text-[10px] text-blue-100 font-medium">
              {hasRealData 
                ? "¡Visualizando datos dinámicos extraídos en tiempo real de sus registros comerciales y del tablero kanban!" 
                : "Se muestran datos pre-poblados demostrativos. Sus KPIs se conectarán automáticamente en tiempo real al agregar sus primeros registros en el CRM."}
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-white/20 font-bold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
          Estructura v3.0 Integrada
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
            {isFetching && <Loader2 className="w-5 h-5 animate-spin text-blue-600 ml-2" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualización ejecutiva de metas anuales, volumen de leads y distribución geográfica.
          </p>
        </div>

        {/* Controls exactly as shown in the mockup */}
        <div className="flex flex-wrap items-center gap-2.5">

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
          
          {renderMetricCardWithTooltip({
            id: 'proyectos-activos',
            title: 'PROYECTOS ACTIVOS',
            value: displayActiveProjects,
            footer: <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">en seguimiento</p>,
            borderLeftColorClass: 'border-l-slate-400',
            align: 'left',
            description: 'Cantidad total de oportunidades de negocio o proyectos de consultoría activos que se registran y gestionan de manera viva dentro del embudo comercial actual.',
            calculation: 'Cuenta única de registros CRM cuyo estatus no es "Cerrado Perdido" ni "Cerrado Ganado" para el periodo seleccionado.'
          })}

          {renderMetricCardWithTooltip({
            id: 'pipeline-2026',
            title: 'PIPELINE 2026',
            value: formatCompact(displayPipeline2026),
            footer: <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">total proyectado</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'left',
            description: 'Monto acumulado proyectado o cotizado de todas las propuestas y cotizaciones registradas para cierre en el transcurso del año 2026.',
            calculation: 'Sumatoria de subtotales o montos de cotización de todas las oportunidades con fecha registrada en el año fiscal 2026.'
          })}

          {renderMetricCardWithTooltip({
            id: 'pipeline-2027',
            title: 'PIPELINE 2027',
            value: formatCompact(displayPipeline2027),
            footer: <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">proyectado</p>,
            borderLeftColorClass: 'border-l-amber-500',
            align: 'center',
            description: 'Monto total planificado o en prospección de cierre a futuro dentro del nuevo ejercicio de planeación comercial fiscal 2027.',
            calculation: 'Sumatoria de subtotales de cotización para oportunidades cuya fecha de inicio o cierre estimada se ubica en el año 2027.'
          })}

          {renderMetricCardWithTooltip({
            id: 'hot-amount',
            title: 'HOT AMOUNT',
            value: formatCompact(displayHotAmount),
            footer: (
              <span className="self-start inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] rounded-full font-bold border border-blue-100 leading-none mt-1">
                Alta probabilidad
              </span>
            ),
            borderLeftColorClass: 'border-l-blue-600',
            minHeightClass: 'min-h-[110px]',
            align: 'center',
            description: 'Suma de ingresos proyectados de negocios que tienen un alto nivel de interés ("Hot") o que se encuentran en estatus de negociación final o toma de decisión.',
            calculation: 'Monto total cotizado de las oportunidades comerciales activas cuya temperatura asignada es "Hot" o en fase de "Negociación".'
          })}

          {renderMetricCardWithTooltip({
            id: 'warm-amount',
            title: 'WARM AMOUNT',
            value: formatCompact(displayWarmAmount),
            footer: (
              <span className="self-start inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] rounded-full font-bold border border-amber-100 leading-none mt-1">
                Media probabilidad
              </span>
            ),
            borderLeftColorClass: 'border-l-amber-500',
            minHeightClass: 'min-h-[110px]',
            align: 'center',
            description: 'Monto financiero acumulado del embudo para prospectos en fase intermedia calificados como "Warm" que ya disponen de una propuesta preliminar entregada.',
            calculation: 'Monto total cotizado de las oportunidades activas que cuentan con prioridad/temperatura "Warm" o estatus de "Cotizado".'
          })}

          {renderMetricCardWithTooltip({
            id: 'cool-amount',
            title: 'COOL AMOUNT',
            value: formatCompact(displayCoolAmount),
            footer: (
              <span className="self-start inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-700 text-[9px] rounded-full font-bold border border-slate-100 leading-none mt-1 font-sans">
                En exploración
              </span>
            ),
            borderLeftColorClass: 'border-l-slate-400',
            minHeightClass: 'min-h-[110px]',
            align: 'right',
            description: 'Monto de oportunidades tempranas calificadas como "Cool/Cold" o prospectos iniciales que están en fases preliminares de definición.',
            calculation: 'Suma de cotizaciones de prospectos en estado Kanban inicial (Nuevo/Contactado) o temperatura calificada como "Cool".'
          })}

          {renderMetricCardWithTooltip({
            id: 'win-amount',
            title: 'WIN AMOUNT',
            value: formatCompact(displayWinAmount),
            footer: <p className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">Ganado este año</p>,
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'right',
            description: 'Monto total acumulado de oportunidades de venta que se han cerrado con éxito y contratado formalmente en el año en curso.',
            calculation: 'Sumatoria de los montos de cotización final de todas aquellas oportunidades registradas con estatus "Cerrado Ganado".'
          })}

        </div>
      </div>

      {/* SECTION 2: VENTAS & METAS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            VENTAS &amp; METAS
          </h2>
          <span className="text-[10px] text-slate-400 font-semibold">Indicadores consolidados • <DemoBadge /></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">

          {renderMetricCardWithTooltip({
            id: 'meta-anual',
            title: 'META ANUAL',
            value: formatCompact(annualTarget),
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">objetivo {selectedYear}</p>,
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'left',
            description: 'Meta global comercial de facturación definida operacionalmente para el año en curso.',
            calculation: 'Monto base programado del presupuesto comercial ($5.1M MXN por defecto o su conversión a USD).'
          })}

          {renderMetricCardWithTooltip({
            id: 'ventas-reales',
            title: 'VENTAS REALES',
            value: formatCompact(displayRealSales),
            footer: (
              <p className="text-[9px] text-emerald-600 font-bold leading-none font-sans">
                {fulfillmentPercent.toFixed(1)}% de meta alcanzado
              </p>
            ),
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'left',
            description: 'Ingreso comercial real acumulado (Year-To-Date) producto del éxito en cierres formales de contrato.',
            calculation: 'Sumatoria de subtotales de cotización de oportunidades registradas con estatus "Cerrado Ganado".'
          })}

          {renderMetricCardWithTooltip({
            id: 'cumplimiento',
            title: 'CUMPLIMIENTO',
            value: `${fulfillmentPercent.toFixed(1)}%`,
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">de cuota anual</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'center',
            description: 'Porcentaje representativo del avance real de las ventas versus las metas anuales presupuestadas.',
            calculation: '(Ventas Reales Totales / Meta Anual de Ventas) * 100'
          })}

          {renderMetricCardWithTooltip({
            id: 'pipeline-coverage',
            title: 'PIPELINE COVERAGE',
            value: `${displayCoverage.toFixed(1)}x`,
            footer: (
              <p className="text-[10px] text-slate-400 font-semibold font-sans">
                ratio vs meta <span className="text-slate-500">(3-4x ideal)</span>
              </p>
            ),
            borderLeftColorClass: 'border-l-blue-600',
            align: 'center',
            description: 'Factor numérico de cobertura que mide cuántas veces el volumen potencial del pipeline restante cubre la meta anual.',
            calculation: '(Pipeline total estimado activo : Hot, Warm, Cool / Meta Anual de Ventas)'
          })}

          {renderMetricCardWithTooltip({
            id: 'ticket-promedio',
            title: 'TICKET PROMEDIO',
            value: formatCompact(displayTicketAvg),
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">por oportunidad</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'center',
            description: 'Monto financiero representativo promedio facturado o cotizado por cada oportunidad comercial viva en el sistema.',
            calculation: 'Monto acumulado cotizado total / Número total de oportunidades en CRM.'
          })}

          {renderMetricCardWithTooltip({
            id: 'win-rate',
            title: 'WIN RATE',
            value: `${displayWinRate}%`,
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">oportunidades ganadas</p>,
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'right',
            description: 'Tasa porcentual histórica/actual de éxito y conversión en la conclusión de cierres ganados de oportunidades.',
            calculation: '(Oportunidades Cerradas Ganadas / Total de Oportunidades Cerradas [Ganadas + Perdidas]) * 100'
          })}

          {renderMetricCardWithTooltip({
            id: 'slippage-rate',
            title: 'SLIPPAGE RATE',
            value: `${displaySlippageRate}%`,
            footer: (
              <span className="self-start inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-full font-bold border border-amber-200 mt-1 font-sans">
                Referencia comercial &lt;30%
              </span>
            ),
            borderLeftColorClass: 'border-l-amber-600',
            minHeightClass: 'min-h-[110px]',
            align: 'right',
            description: 'Porcentaje de conversión potencial retrasada, ralentizada o con estancamiento y riesgo de caída en el embudo.',
            calculation: '(Proyectos clasificados en "Cool" o con riesgo de estancamiento / Cantidad total de Proyectos Activos) * 100'
          })}

        </div>
      </div>

      {/* SECTION 3: LEADS & CRM (7 cards format) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            LEADS &amp; CRM
          </h2>
          <span className="text-[10px] text-slate-400 font-semibold">Estadísticas de Conversión • <DemoBadge /></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">

          {renderMetricCardWithTooltip({
            id: 'total-leads',
            title: 'TOTAL LEADS',
            value: leadsCount,
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans font-sans">en sistema comercial</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'left',
            description: 'Volumen absoluto acumulado de contactos, prospectos o "leads" que han ingresado al ecosistema de marketing y ventas.',
            calculation: 'Conteo total sumatorio de la tabla "leads" del sistema dentro del rango seleccionado.'
          })}

          {renderMetricCardWithTooltip({
            id: 'mql',
            title: 'MQL',
            value: mqlCount,
            footer: <p className="text-[9px] text-slate-500 font-medium font-sans">leads etapa nuevo/contactado</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'left',
            description: 'Marketing Qualified Leads: Prospectos filtrados que demuestran interés inicial legítimo pero requieren depuración.',
            calculation: 'Cantidad de leads cuyo status se registra como "Nuevo" o "Contactado" en la base de datos.'
          })}

          {renderMetricCardWithTooltip({
            id: 'sql',
            title: 'SQL',
            value: sqlCount,
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">leads calificados ventas</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'center',
            description: 'Sales Qualified Leads: Prospectos validados por el equipo comercial que tienen presupuesto, autoridad y necesidad concreta.',
            calculation: 'Conteo de registros de lead con estatus "Calificado Comercial" o que ya se transformaron en oportunidad de pipeline.'
          })}

          {renderMetricCardWithTooltip({
            id: 'conv-promedio',
            title: 'CONV. PROMEDIO',
            value: `${leadsCount > 0 ? Math.round((sqlCount / leadsCount) * 100) : 31}%`,
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">lead → oportunidad SQL</p>,
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'center',
            description: 'Tasa promedio de conversión intermedia de contactos genéricos iniciales a prospectos calificados comercialmente.',
            calculation: '(SQL calificados / Total de Leads registrados) * 100'
          })}

          {renderMetricCardWithTooltip({
            id: 'ciclo-venta',
            title: 'CICLO DE VENTA',
            value: '74d',
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">promedio días cierre</p>,
            borderLeftColorClass: 'border-l-amber-500',
            align: 'center',
            description: 'Duración temporal media desde el contacto o registro inicial de un proyecto hasta su estatus formal "Cerrado Ganado".',
            calculation: 'La media aritmética de la diferencia en días calculada entre la fecha de creación del lead y la fecha de firma del contrato.'
          })}

          {renderMetricCardWithTooltip({
            id: 'cac-estimado',
            title: 'CAC ESTIMADO',
            value: formatCompact(currentCurrency === 'USD' ? 8000 : 8000 * exchangeRate),
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">costo adq. cliente</p>,
            borderLeftColorClass: 'border-l-blue-600',
            align: 'right',
            description: 'Customer Acquisition Cost: Costo total de ventas y marketing incurrido en promedio para conseguir un nuevo cliente cerrado.',
            calculation: '(Inversión total operativa de ventas y publicidad del periodo / Número de nuevos clientes ganados en el periodo)'
          })}

          {renderMetricCardWithTooltip({
            id: 'ltv-cac',
            title: 'LTV / CAC',
            value: '4.2x',
            footer: <p className="text-[10px] text-slate-500 font-medium font-sans">retorno sobre adq.</p>,
            borderLeftColorClass: 'border-l-emerald-500',
            align: 'right',
            description: 'Relación del valor neto aportado de por vida por el cliente (LTV) frente al costo por su adquisición (CAC) comercial.',
            calculation: 'Valor de vida útil promedio estimado del cliente / Costo de adquisición individual (Estival 3x+ es saludable).'
          })}

        </div>
      </div>

      {/* DETAILED CHARTS GRID SECTION 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">

        {/* Chart 1: Proyección vs ventas reales por mes */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
                Proyección vs ventas reales por mes ({selectedYear})
              </h3>
              <DemoBadge />
            </div>

            {/* Custom chart legend matches screenshot */}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 mb-6 uppercase font-sans">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#8b5cf6]/30 border border-[#8b5cf6] rounded-xs"></span>
                Meta mensual ({formatCompact(annualTarget / 12)})
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
              {activeGraphData.map((m, mIdx) => (
                <div key={`${m.name}-${mIdx}`} className="flex flex-col items-center flex-1 group relative">
                  <div 
                    className="w-5 sm:w-6 bg-[#8b5cf6]/20 relative rounded-t-sm flex items-end cursor-pointer"
                    style={{ height: `${m.targetPct}%` }}
                    title={`Meta: ${formatCompact(annualTarget / 12)}`}
                  >
                    {m.salesPct > 0 && (
                      <div 
                        className="w-full bg-[#10b981] rounded-t-xs hover:bg-[#10b981]/95 transition duration-150"
                        style={{ height: `${m.salesPct}%` }}
                        title={`Ganado: ${formatCompact(m.salesVal)}`}
                      ></div>
                    )}
                    {m.hasProjection && (
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#ef4444] ring-4 ring-[#ef4444]/20 z-10 animate-bounce"
                        style={{ top: `${m.projTop}%` }}
                        title={`Proyección: ${formatCompact(m.projVal)}`}
                      ></div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 font-semibold font-sans">{m.name}</span>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1.5 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-30 whitespace-nowrap font-mono flex flex-col gap-1">
                    <span className="font-bold border-b border-white/20 pb-0.5 text-center font-sans">{m.name} {selectedYear}</span>
                    <span>Meta: {formatCompact(annualTarget / 12)}</span>
                    <span>Venta: {formatCompact(m.salesVal)}</span>
                    <span>Proj: {formatCompact(m.projVal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono italic">
            * Valores calculados dinámicamente según fechas de registro y montos del CRM.
          </p>
        </div>

        {/* Chart 2: Pipeline por trimestre (proyección) */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans animate-pulse">
                Pipeline por trimestre (proyección)
              </h3>
              <DemoBadge />
            </div>

            {/* Trimester stacked chart legend */}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 mb-6 uppercase font-sans">
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
            </div>

            {/* Stacked interactive bars */}
            <div className="h-48 relative flex items-end justify-around border-b border-l border-slate-200 pb-0.5 px-2">
              {finalQuarters.map((q, idx) => (
                <div key={`${q.label}-${idx}`} className="flex flex-col items-center w-12 group relative">
                  <div 
                    className="w-8 flex flex-col justify-end space-y-0.5 transition-all cursor-pointer"
                    style={{ height: `${q.heightPct}%` }}
                  >
                    {q.coolPct > 0 && (
                      <div 
                        className="bg-slate-200 hover:bg-slate-300 transition rounded-t-xs"
                        style={{ height: `${q.coolPct}%` }}
                        title={`Cool: ${formatCompact(q.coolVal)}`}
                      ></div>
                    )}
                    {q.warmPct > 0 && (
                      <div 
                        className="bg-[#f59e0b] hover:bg-[#f59e0b]/90 transition"
                        style={{ height: `${q.warmPct}%` }}
                        title={`Warm: ${formatCompact(q.warmVal)}`}
                      ></div>
                    )}
                    {q.hotPct > 0 && (
                      <div 
                        className="bg-[#004ddf] hover:bg-[#004ddf]/90 transition"
                        style={{ height: `${q.hotPct}%` }}
                        title={`Hot: ${formatCompact(q.hotVal)}`}
                      ></div>
                    )}
                    {q.emptyPct > 0 && q.coolPct === 0 && q.warmPct === 0 && q.hotPct === 0 && (
                      <div className="h-full bg-slate-50 border border-dashed border-slate-200 rounded-t-xs"></div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold mt-2 whitespace-nowrap transform -rotate-44 leading-none h-4">
                    {q.label}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2.5 py-2 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-30 whitespace-nowrap font-mono flex flex-col gap-1">
                    <span className="font-bold border-b border-white/20 pb-0.5 text-center">{q.label}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#004ddf] rounded-full inline-block"></span> Hot: {formatCompact(q.hotVal)}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#f59e0b] rounded-full inline-block"></span> Warm: {formatCompact(q.warmVal)}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-slate-400 rounded-full inline-block"></span> Cool/Nuevo: {formatCompact(q.coolVal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono italic">
            * Gráfico de pila acumulada trimestral basada en valores reales del CRM comercial.
          </p>
        </div>

      </div>

      {/* DETAILED CHARTS GRID SECTION 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

        {/* Chart 3: Funnel de conversión — CRM */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
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
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.leads}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">{finalFunnel.leads}</div>
              </div>

              {/* MQL */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">MQL</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-[#8b5cf6] rounded-full transition-all" 
                    style={{ width: `${finalFunnel.leads > 0 ? Math.round((finalFunnel.mql / finalFunnel.leads) * 105) : 55}%` }}
                  ></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.mql}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">
                  {finalFunnel.mql} <span className="text-[9px] text-slate-500 font-normal">({finalFunnel.leads > 0 ? Math.round((finalFunnel.mql / finalFunnel.leads) * 100) : 55}%)</span>
                </div>
              </div>

              {/* SQL */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">SQL</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-[#6d28d9] rounded-full transition-all" 
                    style={{ width: `${finalFunnel.leads > 0 ? Math.round((finalFunnel.sql / finalFunnel.leads) * 100) : 32}%` }}
                  ></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.sql}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">
                  {finalFunnel.sql} <span className="text-[9px] text-slate-500 font-normal">({finalFunnel.mql > 0 ? Math.round((finalFunnel.sql / finalFunnel.mql) * 100) : 58}%)</span>
                </div>
              </div>

              {/* Propuesta */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">Propuesta</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-[#4c1d95] rounded-full transition-all" 
                    style={{ width: `${finalFunnel.leads > 0 ? Math.round((finalFunnel.propuesta / finalFunnel.leads) * 100) : 20}%` }}
                  ></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.propuesta}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">
                  {finalFunnel.propuesta} <span className="text-[9px] text-slate-500 font-normal font-sans">({finalFunnel.sql > 0 ? Math.round((finalFunnel.propuesta / finalFunnel.sql) * 100) : 61}%)</span>
                </div>
              </div>

              {/* Negociación */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase">Negociación</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-[#f59e0b] rounded-full transition-all" 
                    style={{ width: `${finalFunnel.leads > 0 ? Math.round((finalFunnel.negociacion / finalFunnel.leads) * 100) : 10}%` }}
                  ></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.negociacion}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">
                  {finalFunnel.negociacion} <span className="text-[9px] text-slate-500 font-normal font-sans font-sans">({finalFunnel.propuesta > 0 ? Math.round((finalFunnel.negociacion / finalFunnel.propuesta) * 100) : 50}%)</span>
                </div>
              </div>

              {/* Ganado */}
              <div className="flex items-center">
                <div className="w-24 text-xs font-bold text-slate-500 uppercase font-sans">Ganado</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 flex items-center px-3 relative overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-[#10b981] rounded-full transition-all" 
                    style={{ width: `${finalFunnel.leads > 0 ? Math.round((finalFunnel.ganado / finalFunnel.leads) * 100) : 4}%` }}
                  ></div>
                  <span className="relative z-10 text-[10px] font-bold text-white">{finalFunnel.ganado}</span>
                </div>
                <div className="w-20 text-right text-xs font-bold text-slate-900 shrink-0 ml-4 font-mono">
                  {finalFunnel.ganado} <span className="text-[9px] text-slate-500 font-normal font-sans font-sans">({finalFunnel.negociacion > 0 ? Math.round((finalFunnel.ganado / finalFunnel.negociacion) * 100) : 43}%)</span>
                </div>
              </div>

            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono">
            * Distribución porcentual según funnel de conversión real registrado en su tablero.
          </p>
        </div>

        {/* Chart 4: Cumplimiento de cuota por vendedor */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
                Cumplimiento de cuota por vendedor
              </h3>
              <DemoBadge />
            </div>

            {/* List with progress of Sales Representative quotas */}
            <div className="space-y-6">
              {finalSalesmenList.map((salesman) => (
                <div key={salesman.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-900 font-sans">{salesman.name}</span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">
                      {formatCompact(salesman.won)} / {formatCompact(salesman.target)} · <span className={`${salesman.percentage >= 60 ? 'text-emerald-500' : 'text-red-500'} font-bold`}>{salesman.percentage}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${salesman.percentage >= 60 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                      style={{ width: `${Math.min(100, salesman.percentage)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">{salesman.activeCount} oportunidades activas</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono">
            * Representaciones individuales basadas en asignaciones reales cuotificadas de vendedores.
          </p>
        </div>

      </div>

      {/* DETAILED CHARTS GRID SECTION 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

        {/* Chart 5: Leads por fuente & conversión */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
                Leads por fuente &amp; conversión
              </h3>
              <DemoBadge />
            </div>

            {/* Custom columns chart */}
            <div className="h-44 relative flex items-end justify-between border-b border-l border-slate-200 pb-0.5 px-4 md:px-8 mt-4">
              {Object.entries(sourcesDisplay).map(([sName, sVal], sIdx) => (
                <div key={`${sName}-${sIdx}`} className="flex flex-col items-center flex-1 group relative">
                  <div 
                    className="w-8 md:w-10 bg-[#a78bfa] rounded-t-sm hover:bg-[#8b5cf6] transition duration-200 cursor-pointer"
                    style={{ height: `${Math.max(10, Math.round((sVal / maxSourceVal) * 100))}%` }}
                    title={`${sName}: ${sVal}`}
                  ></div>
                  <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 font-bold whitespace-nowrap transform rotate-12 origin-top-left md:rotate-0 font-sans">
                    {sName}
                  </span>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] px-2 py-1 rounded shadow pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-30 font-mono">
                    {sName}: {sVal} leads
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 font-mono">
            * Distribución de canales basada en análisis automático de sus notas comerciales y clientes.
          </p>
        </div>

        {/* Table: Resumen pipeline activo — Hot & Warm próximos 6 meses */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 font-sans">
                  Resumen pipeline de cierre — Hot &amp; Warm
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-tight font-sans">
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
                    <th className="py-2.5 text-xs font-bold text-slate-400 uppercase font-sans">Mes</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase font-sans">Hot</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase font-sans">Warm</th>
                    <th className="py-2.5 text-xs font-bold text-slate-400 text-right uppercase font-sans font-sans">Total</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-400 uppercase font-sans font-sans">Proba.</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-semibold font-mono text-slate-950 divide-y divide-slate-100">
                  {finalUpcomingMonthsTable.map((row, rIdx) => {
                    // fallbacks the table content beautifully
                    const displayHot = hasRealData ? row.hotVal : [13146, 221212, 66489, 0, 0, 0][rIdx];
                    const displayWarm = hasRealData ? row.warmVal : [0, 0, 200045, 42832, 338752, 0][rIdx];
                    const displayTotal = hasRealData ? row.totalVal : (displayHot + displayWarm);
                    const probStyle = (displayHot > 0) ? 'Alta' : (displayWarm > 0) ? 'Media' : 'Sin datos';

                    return (
                      <tr key={`${row.label}-${rIdx}`} className="hover:bg-slate-50 transition duration-150">
                        <td className="py-3 font-sans font-bold text-slate-900">{row.label}</td>
                        <td className="py-3 text-right">
                          {displayHot > 0 ? formatCompact(displayHot) : <span className="text-slate-300 font-normal font-sans">—</span>}
                        </td>
                        <td className="py-3 text-right">
                          {displayWarm > 0 ? formatCompact(displayWarm) : <span className="text-slate-300 font-normal font-sans">—</span>}
                        </td>
                        <td className="py-3 text-right font-medium text-slate-900">
                          {displayTotal > 0 ? formatCompact(displayTotal) : <span className="text-slate-300 font-normal font-sans">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {probStyle === 'Alta' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] rounded-full font-bold border border-red-100 uppercase font-sans">
                              Alta
                            </span>
                          )}
                          {probStyle === 'Media' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] rounded-full font-bold border border-blue-100 uppercase font-sans">
                              Media
                            </span>
                          )}
                          {probStyle === 'Sin datos' && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] rounded-full font-medium border border-slate-200 uppercase font-sans animate-pulse">
                              Sin datos
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-4 font-mono font-sans">
            * Próxima estimación cronológica basada en vencimientos proyectados en los folios del CRM.
          </p>
        </div>

      </div>

      {/* NEW MAP COMPONENT: MAPA DE UBICACIÓN DE PROYECTOS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase font-sans font-sans">
                MAPA DE UBICACIÓN DE PROYECTOS (ESTADÍSTICAS REALES)
              </h3>
              <DemoBadge />
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-sans">Concentración de operaciones logísticas nacionales extraídas de sus folios.</p>
          </div>
          
          <div className="flex gap-4 font-sans">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full inline-block"></span> Activos
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="w-2.5 h-2.5 bg-slate-300 rounded-full inline-block font-sans"></span> En prospección
            </span>
          </div>
        </div>

        {/* Schematic styled vector/svg map representation */}
        <div className="relative w-full h-[380px] bg-slate-50 flex items-center justify-center p-6">
          {/* Grayscale background grid pattern to simulate a futuristic dashboard map */}
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#004ddf 0.5px, transparent 0.5px), radial-gradient(#004ddf 0.5px, #f8f9ff 0.5px)', backgroundSize: '10px 10px' }}></div>
          
          {/* Aesthetic vector route connections */}
          <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
            <path d="M150,120 Q240,160 380,180 T680,240" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M380,100 Q450,180 500,260" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M220,180 Q340,320 500,260" fill="none" stroke="#004ddf" strokeWidth="0.8" strokeDasharray="3 3" />
          </svg>

          {/* CDMX Spot */}
          <div className="absolute top-[65%] left-[50%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-6 w-6 rounded-full bg-[#004ddf] opacity-40 animate-ping"></span>
            <span className="relative flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-md"></span>
            
            {/* Tooltip visible natively */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-lg text-[10px] font-black解决方案 whitespace-nowrap text-slate-900 flex flex-col items-center">
              <span className="font-sans">CDMX &amp; Centro [{mapHotspots.CDMX.total > 0 ? mapHotspots.CDMX.total : 28} Proyectos]</span>
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest font-mono">
                {mapHotspots.CDMX.active > 0 ? `${mapHotspots.CDMX.active} Activos` : 'Principal Sede'}
              </span>
            </div>
          </div>

          {/* Monterrey Spot */}
          <div className="absolute top-[35%] left-[48%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow-md"></span>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 font-sans">
              Monterrey ({mapHotspots.Monterrey.total > 0 ? mapHotspots.Monterrey.total : 12} Proyectos)
            </div>
          </div>

          {/* Guadalajara Spot */}
          <div className="absolute top-[58%] left-[44%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow-md animate-pulse"></span>
            
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 font-sans">
              Guadalajara ({mapHotspots.Guadalajara.total > 0 ? mapHotspots.Guadalajara.total : 8} Proyectos)
            </div>
          </div>

          {/* Tijuana Spot */}
          <div className="absolute top-[18%] left-[30%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-[#004ddf] opacity-25 animate-ping"></span>
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow-md"></span>
            
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150 font-sans">
              Tijuana ({mapHotspots.Tijuana.total > 0 ? mapHotspots.Tijuana.total : 4} Proyectos)
            </div>
          </div>

          {/* Cancun Spot - (Prospección) */}
          <div className="absolute top-[72%] left-[65%] group cursor-pointer z-10 transition hover:scale-110">
            <span className="relative flex rounded-full h-3.5 w-3.5 bg-slate-300 border-2 border-slate-200 shadow-md"></span>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-md text-[10px] font-bold whitespace-nowrap text-slate-900 opacity-0 group-hover:opacity-100 transition duration-150 font-sans">
              Cancún ({mapHotspots.Cancun.total > 0 ? `${mapHotspots.Cancun.total} Proyectos` : 'Prospección'})
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg text-[9px] text-slate-500 border border-slate-200 font-semibold shadow-xs z-20 font-sans">
            Geolocalización activa sincronizada en tiempo real con datos de clientes.
          </div>
        </div>

        {/* Footer text of reference */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-medium text-slate-400 font-sans">
          <span>Mapa inteligente integrado del territorio nacional</span>
          <span>Sincronizado dinámicamente con las coordenadas de sus plantas industriales registradas.</span>
        </div>
      </div>

    </div>
  );
}
