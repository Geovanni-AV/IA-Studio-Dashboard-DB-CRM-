import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  MoreVertical, 
  Check, 
  Edit2, 
  Trash2, 
  Settings, 
  AlertCircle, 
  Clock, 
  CheckSquare, 
  FileText, 
  MessageSquare, 
  MapPin, 
  FilterX 
} from 'lucide-react';
import { CRMRecord, UserRole, UserAccount } from '../../types';

export interface KanbanMeta {
  stage: string;
  dateEnteredStage: string; // YYYY-MM-DD
  responsable: string | null;
  subtasks: { id: string; text: string; completed: boolean }[];
  tags: string[];
  motivoCierre?: string;
  notasCierre?: string;
  stagnation_days_limit?: number;
}

interface KanbanCardItemProps {
  card: CRMRecord;
  meta: KanbanMeta;
  role: string;
  stage: string;
  isDragging: boolean;
  isDraggedOver: boolean;
  getDaysInStage: (dateEntered: string) => number;
  handleCardDragStart: (e: React.DragEvent, id: string) => void;
  handleCardDragEnd: () => void;
  handleCardDragOverCard: (e: React.DragEvent, id: string, stage: string) => void;
  handleCardDropOnCard: (e: React.DragEvent, id: string, stage: string) => void;
  setActiveDrawerRecordId: (id: string | null) => void;
  setPdfPromptRecord: (card: CRMRecord | null) => void;
  setPdfPromptOpen: (open: boolean) => void;
  getInitials: (name: string) => string;
  getAvatarBg: (name: string | null | undefined) => string;
  stageThresholds: Record<string, { warn: number; critical: number }>;
}

const areEqual = (prevProps: KanbanCardItemProps, nextProps: KanbanCardItemProps) => {
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.prioridad === nextProps.card.prioridad &&
    prevProps.card.total_subtotal_cotizacion === nextProps.card.total_subtotal_cotizacion &&
    prevProps.card.informacion_general_moneda === nextProps.card.informacion_general_moneda &&
    prevProps.card.informacion_general_cliente === nextProps.card.informacion_general_cliente &&
    prevProps.card.informacion_general_proyecto === nextProps.card.informacion_general_proyecto &&
    prevProps.card.informacion_general_planta === nextProps.card.informacion_general_planta &&
    prevProps.card.informacion_general_link_cotizacion === nextProps.card.informacion_general_link_cotizacion &&
    prevProps.card.status_proyecto === nextProps.card.status_proyecto &&
    JSON.stringify(prevProps.card.acciones_seguimiento) === JSON.stringify(nextProps.card.acciones_seguimiento) &&
    prevProps.role === nextProps.role &&
    prevProps.stage === nextProps.stage &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDraggedOver === nextProps.isDraggedOver &&
    prevProps.meta.stage === nextProps.meta.stage &&
    prevProps.meta.dateEnteredStage === nextProps.meta.dateEnteredStage &&
    prevProps.meta.responsable === nextProps.meta.responsable &&
    prevProps.meta.stagnation_days_limit === nextProps.meta.stagnation_days_limit &&
    JSON.stringify(prevProps.meta.subtasks) === JSON.stringify(nextProps.meta.subtasks) &&
    JSON.stringify(prevProps.meta.tags) === JSON.stringify(nextProps.meta.tags)
  );
};

const KanbanCardItem = React.memo(function KanbanCardItem({
  card,
  meta,
  role,
  stage,
  isDragging,
  isDraggedOver,
  getDaysInStage,
  handleCardDragStart,
  handleCardDragEnd,
  handleCardDragOverCard,
  handleCardDropOnCard,
  setActiveDrawerRecordId,
  setPdfPromptRecord,
  setPdfPromptOpen,
  getInitials,
  getAvatarBg,
  stageThresholds
}: KanbanCardItemProps) {
  const days = getDaysInStage(meta.dateEnteredStage);
  
  const getDaysSemaphore = (st: string, d: number) => {
    const thresh = stageThresholds[st] || { warn: 5, critical: 10 };
    if (d >= thresh.critical) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (d >= thresh.warn) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      return 'bg-green-50 text-green-700 border-green-200';
    }
  };
  const semClass = getDaysSemaphore(stage, days);

  const checkFollowupOverdue = () => {
    if (!card.acciones_seguimiento || card.acciones_seguimiento.length === 0) return false;
    const lastFollow = card.acciones_seguimiento[card.acciones_seguimiento.length - 1];
    if (!lastFollow.fecha) return false;
    const fDate = new Date(lastFollow.fecha);
    const tDate = new Date('2026-06-14'); // Today metadata reference date
    return fDate < tDate;
  };
  const overdue = checkFollowupOverdue();

  const stagLimit = meta.stagnation_days_limit || 5;
  const isStalled = days >= stagLimit;

  const lastInteraction = card.acciones_seguimiento && card.acciones_seguimiento.length > 0
    ? card.acciones_seguimiento[card.acciones_seguimiento.length - 1]
    : null;

  const completedCount = meta.subtasks ? meta.subtasks.filter((s: any) => s.completed).length : 0;
  const hasSubtasks = meta.subtasks && meta.subtasks.length > 0;
  const totalCount = meta.subtasks ? meta.subtasks.length : 0;
  const allCompleted = hasSubtasks && completedCount === totalCount;

  const getTemperatureLeftBar = (temp: string | null | undefined) => {
    switch (temp) {
      case 'Hot': return 'border-l-red-500';
      case 'Warm': return 'border-l-amber-500';
      case 'Cool': return 'border-l-sky-500';
      case 'Win': return 'border-l-emerald-500';
      default: return 'border-l-slate-400';
    }
  };

  const renderTemperaturePill = (status: string | null | undefined) => {
    switch (status) {
      case 'Hot':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">
            <span>🔥</span> HOT
          </span>
        );
      case 'Warm':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
            <span>⚡</span> WARM
          </span>
        );
      case 'Cool':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200">
            <span>❄️</span> COOL
          </span>
        );
      case 'Win':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            <span>🏆</span> WIN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
            <span>❓</span> S/D
          </span>
        );
    }
  };

  return (
    <div
      draggable={role !== 'Solo Lectura'}
      onDragStart={(e) => handleCardDragStart(e, card.id)}
      onDragEnd={handleCardDragEnd}
      onDragOver={(e) => handleCardDragOverCard(e, card.id, stage)}
      onDrop={(e) => handleCardDropOnCard(e, card.id, stage)}
      onClick={() => {
        setActiveDrawerRecordId(card.id);
      }}
      className={`bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs p-3.5 flex flex-col justify-between cursor-pointer transition-all border-l-4 ${getTemperatureLeftBar(card.status_proyecto)} hover:translate-y-[-1px] select-text gap-3 ${
        isDragging ? 'opacity-40 scale-[0.98]' : ''
      } ${
        isDraggedOver ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10 scale-[1.01]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div>
          <h5 className="text-[12px] font-bold text-slate-900 leading-snug line-clamp-1">
            {card.informacion_general_cliente || 'Cliente sin asignar'}
          </h5>
          <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5 inline-block" title="Folio del proyecto">
            #{card.informacion_general_folio || 'S/F'}
          </span>
        </div>
        <div className="shrink-0">
          {renderTemperaturePill(card.status_proyecto)}
        </div>
      </div>

      <div className="space-y-1">
        <h6 className="text-[11.5px] font-medium text-slate-700 leading-snug line-clamp-2">
          {card.informacion_general_proyecto || <span className="italic text-slate-400">Sin descripción de proyecto</span>}
        </h6>
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{card.informacion_general_planta || 'Planta sin asignar'}</span>
        </p>
      </div>

      <div className="space-y-2">
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-medium">Subtotal:</span>
          <span className="text-xs font-extrabold text-slate-800">
            ${(card.total_subtotal_cotizacion || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {card.informacion_general_moneda || 'USD'}
          </span>
        </div>
        
        {lastInteraction ? (
          <div className="flex items-start gap-1 text-[10px] text-slate-500 italic bg-slate-50/70 border border-slate-100/70 rounded-lg p-2 leading-relaxed">
            <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{lastInteraction.notas}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 italic bg-slate-50/30 border border-dashed border-slate-150 rounded-lg p-2">
            <MessageSquare className="w-3 h-3 shrink-0 text-slate-300" />
            <span>Sin interacciones registradas</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasSubtasks && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
              allCompleted 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <CheckSquare className="w-3 h-3" />
              <span>{completedCount}/{totalCount}</span>
            </span>
          )}

          {isStalled ? (
            <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse" title={`Días en etapa supera límite de ${stagLimit} días`}>
              <Clock className="w-3 h-3 text-red-600 shrink-0" />
              <span>⚠️ Estancado {days}d</span>
            </span>
          ) : (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 ${semClass}`}>
              <Clock className="w-3 h-3" />
              <span>{days}d</span>
            </span>
          )}

          {overdue && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" title="Seguimiento atrasado" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (card.informacion_general_link_cotizacion && card.informacion_general_link_cotizacion.trim().startsWith('http')) {
                window.open(card.informacion_general_link_cotizacion.trim(), '_blank');
              } else {
                setPdfPromptRecord(card);
                setPdfPromptOpen(true);
              }
            }}
            title={card.informacion_general_link_cotizacion ? "Ver Cotización PDF" : "Sin Enlace de Cotización"}
            className={`p-1 border rounded-lg transition-all flex items-center justify-center cursor-pointer ${
              card.informacion_general_link_cotizacion && card.informacion_general_link_cotizacion.trim()
                ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-600 active:scale-95'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 active:scale-95'
            }`}
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <div 
            className={`w-6 h-6 rounded-full ${getAvatarBg(meta.responsable)} text-[10px] font-medium flex items-center justify-center shrink-0 shadow-3xs border border-white`}
            title={`Responsable: ${meta.responsable || 'Sin asignar'}`}
          >
            {getInitials(meta.responsable || '')}
          </div>
        </div>
      </div>
    </div>
  );
}, areEqual);

interface KanbanBoardProps {
  records: CRMRecord[];
  role: string;
  dbUsers: UserAccount[];
  kanbanMeta: Record<string, KanbanMeta>;
  setKanbanMeta: React.Dispatch<React.SetStateAction<Record<string, KanbanMeta>>>;
  kanbanColumns: string[];
  setKanbanColumns: React.Dispatch<React.SetStateAction<string[]>>;
  wipLimits: Record<string, number>;
  setWipLimits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onUpdateRecord: (record: CRMRecord) => void;
  setActiveDrawerRecordId: (id: string | null) => void;
  setPdfPromptRecord: (card: CRMRecord | null) => void;
  setPdfPromptOpen: (open: boolean) => void;
  getDaysInStage: (dateEntered: string) => number;
  handleCardDragStart: (e: React.DragEvent, id: string) => void;
  handleCardDragEnd: () => void;
  handleCardDragOverCard: (e: React.DragEvent, id: string, stage: string) => void;
  handleCardDropOnCard: (e: React.DragEvent, id: string, stage: string) => void;
  handleCardDropOnColumn: (e: React.DragEvent, targetStage: string) => void;
  dragOverStage: string | null;
  setDragOverStage: React.Dispatch<React.SetStateAction<string | null>>;
  draggingCardId: string | null;
  draggedOverCardId: string | null;
  columnSorting: Record<string, string | null>;
  setColumnSorting: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  handleAddNewCardInStage: (stage: string) => void;
  setColumnConfigOpen: (open: boolean) => void;
  stageThresholds: Record<string, { warn: number; critical: number }>;
  getStageStyles: (st: string) => { dot: string; bg: string };
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

export default function KanbanBoard({
  records,
  role,
  dbUsers,
  kanbanMeta,
  setKanbanMeta,
  kanbanColumns,
  setKanbanColumns,
  wipLimits,
  setWipLimits,
  onUpdateRecord,
  setActiveDrawerRecordId,
  setPdfPromptRecord,
  setPdfPromptOpen,
  getDaysInStage,
  handleCardDragStart,
  handleCardDragEnd,
  handleCardDragOverCard,
  handleCardDropOnCard,
  handleCardDropOnColumn,
  dragOverStage,
  setDragOverStage,
  draggingCardId,
  draggedOverCardId,
  columnSorting,
  setColumnSorting,
  handleAddNewCardInStage,
  setColumnConfigOpen,
  stageThresholds,
  getStageStyles,
  searchTerm,
  setSearchTerm
}: KanbanBoardProps) {
  
  const [kanbanFilterResponsable, setKanbanFilterResponsable] = useState<string>('All');
  const [kanbanFilterTemperature, setKanbanFilterTemperature] = useState<string>('All');
  const [kanbanFilterClient, setKanbanFilterClient] = useState<string>('All');
  const [kanbanMiKanbanOnly, setKanbanMiKanbanOnly] = useState<boolean>(false);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null);

  // Synchronize local search with parent's search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm, setSearchTerm]);

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  const RESPONSIBLES = useMemo(() => {
    const registeredCommercial = (dbUsers || [])
      .filter(u => u.estado === 'active')
      .map(u => u.nombre);
    return registeredCommercial.length > 0
      ? Array.from(new Set(registeredCommercial)).filter(Boolean) as string[]
      : ["Geovanni Andrade"];
  }, [dbUsers]);

  const uniqueClientsList = useMemo(() => {
    return Array.from(new Set(records.map(r => r.informacion_general_cliente).filter(Boolean))) as string[];
  }, [records]);

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarBg = (name: string | null | undefined) => {
    if (!name) return 'bg-slate-400 text-white';
    const colors = [
      'bg-blue-600 text-white',
      'bg-indigo-600 text-white',
      'bg-purple-600 text-white',
      'bg-pink-600 text-white',
      'bg-emerald-600 text-white',
      'bg-amber-600 text-white',
      'bg-cyan-600 text-white'
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
    return colors[h % colors.length];
  };

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`;
    }
    if (amount >= 1e3) {
      return `$${(amount / 1e3).toFixed(0)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const columnsWithCards = useMemo(() => {
    return kanbanColumns.map(stage => {
      let cards = records.filter(r => {
        const meta = kanbanMeta[r.id];
        if (!meta) return false;
        
        if (meta.stage !== stage) return false;

        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchesSearch = 
            (r.informacion_general_folio || '').toLowerCase().includes(q) ||
            (r.informacion_general_cliente || '').toLowerCase().includes(q) ||
            (r.informacion_general_proyecto || '').toLowerCase().includes(q) ||
            (r.informacion_general_planta || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }

        if (kanbanFilterResponsable !== 'All') {
          if (meta.responsable !== kanbanFilterResponsable) return false;
        }

        if (kanbanFilterTemperature !== 'All') {
          if (r.status_proyecto !== kanbanFilterTemperature) return false;
        }

        if (kanbanFilterClient !== 'All') {
          if (r.informacion_general_cliente !== kanbanFilterClient) return false;
        }

        if (kanbanMiKanbanOnly) {
          const isUserSaved = localStorage.getItem('verse_google_user');
          const currentUserName = isUserSaved ? JSON.parse(isUserSaved)?.name || 'Geovanni Andrade' : 'Geovanni Andrade';
          if (meta.responsable !== currentUserName) return false;
        }

        return true;
      });

      const sortType = columnSorting[stage];
      if (sortType === 'monto') {
        cards = [...cards].sort((a,b) => (b.total_subtotal_cotizacion || 0) - (a.total_subtotal_cotizacion || 0));
      } else if (sortType === 'antiguedad') {
        cards = [...cards].sort((a,b) => {
          const daysA = getDaysInStage(kanbanMeta[a.id]?.dateEnteredStage || '');
          const daysB = getDaysInStage(kanbanMeta[b.id]?.dateEnteredStage || '');
          return daysB - daysA;
        });
      } else if (sortType === 'responsable') {
        cards = [...cards].sort((a,b) => {
          const nameA = kanbanMeta[a.id]?.responsable || '';
          const nameB = kanbanMeta[b.id]?.responsable || '';
          return nameA.localeCompare(nameB);
        });
      } else {
        cards = [...cards].sort((a,b) => {
          const pA = a.prioridad !== undefined && a.prioridad !== null ? Number(a.prioridad) : 0;
          const pB = b.prioridad !== undefined && b.prioridad !== null ? Number(b.prioridad) : 0;
          if (pA !== pB) return pB - pA;
          const dateA = a.fecha_registro || '';
          const dateB = b.fecha_registro || '';
          return dateB.localeCompare(dateA) || a.id.localeCompare(b.id);
        });
      }

      const totalMonto = cards.reduce((acc, r) => acc + (r.total_subtotal_cotizacion || 0), 0);
      const limit = wipLimits[stage] || 99;
      const isOverWip = cards.length > limit;

      const totalDays = cards.reduce((acc, r) => acc + getDaysInStage(kanbanMeta[r.id]?.dateEnteredStage || ''), 0);
      const avgDays = cards.length > 0 ? (totalDays / cards.length).toFixed(1) : '0';

      return {
        stage,
        cards,
        totalMonto,
        limit,
        isOverWip,
        avgDays
      };
    });
  }, [kanbanColumns, records, kanbanMeta, searchTerm, kanbanFilterResponsable, kanbanFilterTemperature, kanbanFilterClient, kanbanMiKanbanOnly, columnSorting, wipLimits, getDaysInStage]);

  return (
    <div className="space-y-4 fade-in select-text">
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex flex-wrap items-center justify-between gap-3 text-left">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono">Responsable</span>
            <select
              value={kanbanFilterResponsable}
              onChange={(e) => setKanbanFilterResponsable(e.target.value)}
              className="bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">👤 Todos los Responsables</option>
              {RESPONSIBLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono">Temperatura</span>
            <select
              value={kanbanFilterTemperature}
              onChange={(e) => setKanbanFilterTemperature(e.target.value)}
              className="bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">🔥 Todas las Prioridades</option>
              <option value="Hot">🔥 HOT (Caliente)</option>
              <option value="Warm">⚡ WARM (Intermedio)</option>
              <option value="Cool">❄️ COOL (Congelado)</option>
              <option value="Win">🏆 WIN (Ganado)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono">Planta / Cliente</span>
            <select
              value={kanbanFilterClient}
              onChange={(e) => setKanbanFilterClient(e.target.value)}
              className="bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors focus:ring-1 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="All">🏭 Todos los Clientes</option>
              {uniqueClientsList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {(kanbanFilterResponsable !== 'All' || kanbanFilterTemperature !== 'All' || kanbanFilterClient !== 'All' || localSearchTerm !== '') && (
            <button
              onClick={() => {
                setKanbanFilterResponsable('All');
                setKanbanFilterTemperature('All');
                setKanbanFilterClient('All');
                setLocalSearchTerm('');
              }}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 self-end mt-4 h-8 transition-all cursor-pointer"
            >
              <FilterX className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end">
          <button
            onClick={() => setKanbanMiKanbanOnly(!kanbanMiKanbanOnly)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              kanbanMiKanbanOnly 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white text-slate-600 border-slate-250 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            👤 Mi Kanban
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-350 select-none">
        {columnsWithCards.map(({ stage, cards, totalMonto, limit, isOverWip, avgDays }) => {
          const styles = getStageStyles(stage);

          return (
            <div 
              key={stage}
              className={`flex-1 min-w-[290px] max-w-[290px] rounded-xl p-3 border flex flex-col transition-all ${
                dragOverStage === stage 
                  ? 'bg-blue-50 border-blue-300 border-dashed ring-2 ring-blue-200' 
                  : isOverWip 
                    ? 'ring-2 ring-red-500/30 border-red-300 bg-red-50/10' 
                    : 'bg-slate-50 border-slate-200'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (role !== 'Solo Lectura' && dragOverStage !== stage) {
                  setDragOverStage(stage);
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                if (role !== 'Solo Lectura') {
                  setDragOverStage(stage);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverStage(prev => (prev === stage ? null : prev));
              }}
              onDrop={(e) => {
                handleCardDropOnColumn(e, stage);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${styles.dot}`}></span>
                    <h4 className="text-[13px] font-medium text-slate-700">{stage}</h4>
                    <span className={`text-[11px] px-1.5 rounded font-medium ${
                      isOverWip ? 'bg-red-100 text-red-700' : 'text-slate-400'
                    }`}>
                      {cards.length}{limit < 99 ? `/${limit}` : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold font-mono">
                    {formatCurrencyShort(totalMonto)} USD · prom. {avgDays}d
                  </div>
                </div>

                <div className="flex items-center gap-0.5 relative">
                  <button
                    onClick={() => handleAddNewCardInStage(stage)}
                    disabled={role === 'Solo Lectura'}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Agregar nueva tarjeta a esta etapa"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveColumnMenu(activeColumnMenu === stage ? null : stage);
                    }}
                    className={`p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer ${
                      activeColumnMenu === stage ? 'bg-slate-200 text-slate-850' : ''
                    }`}
                    title="Configuración de columna"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {activeColumnMenu === stage && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveColumnMenu(null);
                        }}
                      />
                      <div className="absolute right-0 top-7 w-[210px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-100 select-none">
                        <div className="px-3 py-1 text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                          Ordenar columna
                        </div>
                        <button
                          onClick={() => {
                            setColumnSorting({ ...columnSorting, [stage]: 'monto' });
                            setActiveColumnMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>Monto de Cotización</span>
                          {columnSorting[stage] === 'monto' && <Check className="w-3 h-3 text-blue-600" />}
                        </button>
                        <button
                          onClick={() => {
                            setColumnSorting({ ...columnSorting, [stage]: 'antiguedad' });
                            setActiveColumnMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>Antigüedad (Días)</span>
                          {columnSorting[stage] === 'antiguedad' && <Check className="w-3 h-3 text-blue-600" />}
                        </button>
                        <button
                          onClick={() => {
                            setColumnSorting({ ...columnSorting, [stage]: 'responsable' });
                            setActiveColumnMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>Responsable</span>
                          {columnSorting[stage] === 'responsable' && <Check className="w-3 h-3 text-blue-600" />}
                        </button>
                        <button
                          onClick={() => {
                            setColumnSorting({ ...columnSorting, [stage]: null });
                            setActiveColumnMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>Por Defecto (Sin orden)</span>
                          {columnSorting[stage] === null && <Check className="w-3 h-3 text-blue-600" />}
                        </button>

                        <div className="h-px bg-slate-100 my-1"></div>

                        <div className="px-3 py-1 text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                          Parámetros
                        </div>
                        <button
                          onClick={() => {
                            setActiveColumnMenu(null);
                            const currentLimit = wipLimits[stage] !== undefined ? wipLimits[stage] : 99;
                            const newLimitStr = prompt(`Establecer límite de trabajo en progreso (WIP) para "${stage}":`, String(currentLimit));
                            if (newLimitStr !== null) {
                              const numeric = parseInt(newLimitStr, 10);
                              if (!isNaN(numeric) && numeric >= 0) {
                                setWipLimits(prev => ({
                                  ...prev,
                                  [stage]: numeric
                                }));
                              } else {
                                alert("Introduce un número válido mayor o igual a 0.");
                              }
                            }
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>Límite WIP</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                            {limit < 99 ? limit : 'Sin límite'}
                          </span>
                        </button>

                        <div className="h-px bg-slate-100 my-1"></div>

                        <div className="px-3 py-1 text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                          Acciones de Columna
                        </div>
                        <button
                          onClick={() => {
                            setActiveColumnMenu(null);
                            const newName = prompt("Introduce el nuevo nombre para la columna:", stage);
                            if (newName && newName.trim() && newName !== stage) {
                              const trimmed = newName.trim();
                              if (kanbanColumns.includes(trimmed) || trimmed === 'Sin Asignar') {
                                alert('La columna ya existe o el nombre es inválido.');
                                return;
                              }
                              const updatedCols = [...kanbanColumns];
                              const idx = updatedCols.indexOf(stage);
                              if (idx !== -1) {
                                updatedCols[idx] = trimmed;
                                const newMeta = { ...kanbanMeta };
                                Object.keys(newMeta).forEach(key => {
                                  if (newMeta[key].stage === stage) {
                                    newMeta[key].stage = trimmed;
                                  }
                                });
                                const newWip = { ...wipLimits };
                                if (newWip[stage] !== undefined) {
                                  newWip[trimmed] = newWip[stage];
                                  delete newWip[stage];
                                }
                                const newSorting = { ...columnSorting };
                                if (newSorting[stage] !== undefined) {
                                  newSorting[trimmed] = newSorting[stage];
                                  delete newSorting[stage];
                                }
                                setKanbanColumns(updatedCols);
                                setKanbanMeta(newMeta);
                                setWipLimits(newWip);
                                setColumnSorting(newSorting);
                              }
                            }
                          }}
                          className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-slate-400" />
                          <span>Editar Nombre</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveColumnMenu(null);
                            if (confirm(`¿Estás seguro de que deseas eliminar la columna "${stage}"?\nTodos los proyectos en esta columna se mantendrán disponibles y se moverán a la lista "Sin Asignar".`)) {
                              setKanbanColumns(kanbanColumns.filter(c => c !== stage));
                              const newMeta = { ...kanbanMeta };
                              records.forEach(r => {
                                if (newMeta[r.id]?.stage === stage) {
                                  newMeta[r.id] = {
                                    ...newMeta[r.id],
                                    stage: 'Sin Asignar',
                                    dateEnteredStage: '2026-06-14'
                                  };
                                }
                              });
                              setKanbanMeta(newMeta);
                              const newWip = { ...wipLimits };
                              if (newWip[stage]) delete newWip[stage];
                              setWipLimits(newWip);
                            }
                          }}
                          className="w-full px-3 py-1.5 text-xs text-red-650 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                          <span>Eliminar Columna</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveColumnMenu(null);
                            setColumnConfigOpen(true);
                          }}
                          className="w-full px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 border-t border-slate-100 mt-1 cursor-pointer"
                        >
                          <Settings className="w-3 h-3 text-blue-500" />
                          <span>Configuración General</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isOverWip && (
                <div className="mt-2 bg-red-100 border border-red-200 px-2.5 py-1 rounded text-[9px] text-red-700 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                  <span>Límite WIP excedido ({cards.length} &gt; {limit})</span>
                </div>
              )}

              <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5 select-text mt-3 min-h-[250px]">
                {cards.length === 0 ? (
                  <div className="h-28 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-3 text-center text-slate-400">
                    <span className="text-[10px] font-medium font-mono uppercase tracking-wider">Vacío / Sin leads</span>
                    <p className="text-[9px] mt-1 shrink-0">Arrastra una ficha aquí para mover.</p>
                  </div>
                ) : (
                  cards.map((card) => {
                    const meta = kanbanMeta[card.id] || {
                      stage: card.etapa || 'Nuevo',
                      dateEnteredStage: card.fecha_cambio_etapa || card.fecha_registro || '2026-06-14',
                      responsable: card.responsable || '',
                      subtasks: Array.isArray(card.__tareas) ? card.__tareas : [],
                      tags: []
                    };
                    return (
                      <KanbanCardItem
                        key={card.id}
                        card={card}
                        meta={meta}
                        role={role}
                        stage={stage}
                        isDragging={draggingCardId === card.id}
                        isDraggedOver={draggedOverCardId === card.id}
                        getDaysInStage={getDaysInStage}
                        handleCardDragStart={handleCardDragStart}
                        handleCardDragEnd={handleCardDragEnd}
                        handleCardDragOverCard={handleCardDragOverCard}
                        handleCardDropOnCard={handleCardDropOnCard}
                        setActiveDrawerRecordId={setActiveDrawerRecordId}
                        setPdfPromptRecord={setPdfPromptRecord}
                        setPdfPromptOpen={setPdfPromptOpen}
                        getInitials={getInitials}
                        getAvatarBg={getAvatarBg}
                        stageThresholds={stageThresholds}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
