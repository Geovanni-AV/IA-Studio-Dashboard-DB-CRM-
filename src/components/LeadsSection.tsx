import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CRMRecord, UserRole, FollowupEntry, Contact, UserAccount } from '../types';
import { getMexicoCityDateString, getMexicoCityDateTimeShortString } from '../dateUtils';
import { toValidUUID, getCRMSettings, updateCRMSettings, subscribeToCRMSettings } from '../supabaseService';
import { safeJsonParse, safeRound } from '../utils/coreUtils';
import { 
  Search, 
  Plus, 
  Filter, 
  FileText, 
  Edit2, 
  Trash2, 
  Eye, 
  ShieldAlert, 
  Lock, 
  X,
  Flame,
  Snowflake,
  Zap,
  Trophy,
  FilterX,
  Calendar,
  MapPin,
  DollarSign,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  CheckSquare,
  MoreVertical,
  AlertCircle,
  Tag,
  Settings,
  GripVertical,
  Check,
  MessageSquare,
  History
} from 'lucide-react';

interface LeadsSectionProps {
  records: CRMRecord[];
  contacts?: Contact[];
  role: UserRole;
  dbUsers?: UserAccount[];
  exchangeRate: number;
  onAddRecord: (record: CRMRecord) => void;
  onUpdateRecord: (record: CRMRecord) => void;
  onDeleteRecord: (id: string) => void;
  onShowAudit: (action: string, details: string) => void;
}

// Stage configuration thresholds for alerts
const STAGE_THRESHOLDS: Record<string, { warn: number; critical: number }> = {
  'Nuevo': { warn: 2, critical: 5 },
  'Contactado': { warn: 4, critical: 8 },
  'Cotizado': { warn: 5, critical: 10 },
  'Negociación': { warn: 7, critical: 15 },
  'Cerrado Ganado': { warn: 30, critical: 60 },
  'Cerrado Perdido': { warn: 30, critical: 60 },
};

const getStageStyles = (st: string) => {
  switch (st) {
    case 'Nuevo': return { dot: 'bg-blue-500', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'Contactado': return { dot: 'bg-cyan-500', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    case 'Cotizado': return { dot: 'bg-amber-500', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Negociación': return { dot: 'bg-purple-500', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'Cerrado Ganado': return { dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-850 border-emerald-200' };
    case 'Cerrado Perdido': return { dot: 'bg-slate-500', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
    default: return { dot: 'bg-slate-450', bg: 'bg-slate-50 text-slate-700' };
  }
};

interface KanbanMeta {
  stage: string;
  dateEnteredStage: string; // YYYY-MM-DD
  responsable: string;
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
  getAvatarBg
}: KanbanCardItemProps) {
  const days = getDaysInStage(meta.dateEnteredStage);
  
  // semaphore class
  const getDaysSemaphore = (st: string, d: number) => {
    const thresh = STAGE_THRESHOLDS[st] || { warn: 5, critical: 10 };
    if (d >= thresh.critical) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (d >= thresh.warn) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      return 'bg-green-50 text-green-700 border-green-200';
    }
  };
  const semClass = getDaysSemaphore(stage, days);

  // next follow up overdue alert check
  const checkFollowupOverdue = () => {
    if (!card.acciones_seguimiento || card.acciones_seguimiento.length === 0) return false;
    const lastFollow = card.acciones_seguimiento[card.acciones_seguimiento.length - 1];
    if (!lastFollow.fecha) return false;
    const fDate = new Date(lastFollow.fecha);
    const tDate = new Date('2026-06-14'); // Today metadata
    return fDate < tDate;
  };
  const overdue = checkFollowupOverdue();

  const stagLimit = meta.stagnation_days_limit || 5;
  const isStalled = days >= stagLimit;

  // Last interaction notes
  const lastInteraction = card.acciones_seguimiento && card.acciones_seguimiento.length > 0
    ? card.acciones_seguimiento[card.acciones_seguimiento.length - 1]
    : null;

  // Checklist stats
  const completedCount = meta.subtasks ? meta.subtasks.filter((s: any) => s.completed).length : 0;
  const hasSubtasks = meta.subtasks && meta.subtasks.length > 0;
  const totalCount = meta.subtasks ? meta.subtasks.length : 0;
  const allCompleted = hasSubtasks && completedCount === totalCount;

  // Level left color-code bar
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
      {/* ZONA 1: Identidad & Prioridad */}
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

      {/* ZONA 2: Núcleo del Proyecto */}
      <div className="space-y-1">
        <h6 className="text-[11.5px] font-medium text-slate-700 leading-snug line-clamp-2">
          {card.informacion_general_proyecto || <span className="italic text-slate-400">Sin descripción de proyecto</span>}
        </h6>
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{card.informacion_general_planta || 'Planta sin asignar'}</span>
        </p>
      </div>

      {/* ZONA 3: Valor & Último Contacto */}
      <div className="space-y-2">
        {/* Valor (Subtotal) */}
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-medium">Subtotal:</span>
          <span className="text-xs font-extrabold text-slate-800">
            ${(card.total_subtotal_cotizacion || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {card.informacion_general_moneda || 'USD'}
          </span>
        </div>
        
        {/* Último Contacto */}
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

      {/* ZONA 4: Operaciones & Indicadores */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Checklist Progress */}
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

          {/* Stagnation Badge / Alert */}
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

          {/* Overdue alert indicator */}
          {overdue && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" title="Seguimiento atrasado" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Fast access PDF (Drive) and link shortcut - ALWAYS visible to prevent data/access loss */}
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

          {/* Assigned Responsible Avatar */}
          <div 
            className={`w-6 h-6 rounded-full ${getAvatarBg(meta.responsable)} text-[10px] font-medium flex items-center justify-center shrink-0 shadow-3xs border border-white`}
            title={`Responsable: ${meta.responsable}`}
          >
            {getInitials(meta.responsable)}
          </div>
        </div>
      </div>
    </div>
  );
}, areEqual);

export default function LeadsSection({
  records,
  contacts = [],
  role,
  dbUsers = [],
  exchangeRate,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onShowAudit
}: LeadsSectionProps) {
  // Dynamic user assignment resolving from registered database users (strictly from the "Usuarios" table)
  const isUserSaved = typeof window !== 'undefined' ? localStorage.getItem('verse_google_user') : null;
  const activeSessionUserName = isUserSaved ? JSON.parse(isUserSaved)?.name : 'Geovanni Andrade';

  const registeredCommercial = (dbUsers || [])
    .filter(u => u.estado === 'active')
    .map(u => u.nombre);

  const RESPONSIBLES = registeredCommercial.length > 0
    ? Array.from(new Set(registeredCommercial)).filter(Boolean) as string[]
    : ["Geovanni Andrade"];

  // Filtering & Search states
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm]);

  // Kanban and View modes states (Kanban initially active as default)
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar' | 'gantt' | 'portfolio'>('kanban');
  
  const [kanbanMeta, setKanbanMeta] = useState<Record<string, KanbanMeta>>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_meta');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {};
  });

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [kanbanColumns, setKanbanColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_columns');
    return saved ? JSON.parse(saved) : ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetStage, setAssignTargetStage] = useState('');
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [assignModalTempFilter, setAssignModalTempFilter] = useState<string>('All');
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColumnIdx, setEditingColumnIdx] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null);

  // WIP limits per column
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_wip_limits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      'Nuevo': 5,
      'Contactado': 4,
      'Cotizado': 8,
      'Negociación': 4,
      'Cerrado Ganado': 99,
      'Cerrado Perdido': 99,
    };
  });

  // Effect to load and subscribe to CRM settings in real-time
  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      if (!url || !key) {
        if (active) setIsSettingsLoaded(true);
        return;
      }

      try {
        const settings = await getCRMSettings(url, key);
        if (!active) return;

        if (settings) {
          setSettingsId(settings.id);
          setKanbanColumns(settings.kanban_columns);
          setWipLimits(settings.wip_limits || {});
        } else {
          // If no settings found, seed with current/default values
          const initialColumns = ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
          const initialWip = {
            'Nuevo': 5,
            'Contactado': 4,
            'Cotizado': 8,
            'Negociación': 4,
            'Cerrado Ganado': 99,
            'Cerrado Perdido': 99,
          };
          const success = await updateCRMSettings({
            kanban_columns: initialColumns,
            wip_limits: initialWip
          }, url, key);

          if (success && active) {
            const reSettings = await getCRMSettings(url, key);
            if (reSettings && active) {
              setSettingsId(reSettings.id);
              setKanbanColumns(reSettings.kanban_columns);
              setWipLimits(reSettings.wip_limits || {});
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching crm_settings:', err);
      } finally {
        if (active) setIsSettingsLoaded(true);
      }
    };

    fetchSettings();

    // Setup subscription
    const url = localStorage.getItem('verse_supabase_url') || '';
    const key = localStorage.getItem('verse_supabase_key') || '';
    let subscription: any = null;

    if (url && key) {
      subscription = subscribeToCRMSettings((payload) => {
        if (payload.new && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
          if (active) {
            setIsSettingsLoaded(false);
            setSettingsId(payload.new.id);
            setKanbanColumns(payload.new.kanban_columns || []);
            setWipLimits(payload.new.wip_limits || {});
            setTimeout(() => {
              if (active) setIsSettingsLoaded(true);
            }, 100);
          }
        }
      }, url, key);
    }

    return () => {
      active = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Save changes back to Supabase
  useEffect(() => {
    if (!isSettingsLoaded) return;

    const pushSettings = async () => {
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      if (!url || !key) return;

      await updateCRMSettings({
        id: settingsId || undefined,
        kanban_columns: kanbanColumns,
        wip_limits: wipLimits
      }, url, key);
    };

    const timer = setTimeout(() => {
      pushSettings();
    }, 500);

    return () => clearTimeout(timer);
  }, [kanbanColumns, wipLimits, isSettingsLoaded, settingsId]);

  // Sorting overrides per Kanban Column
  const [columnSorting, setColumnSorting] = useState<Record<string, 'monto' | 'antiguedad' | 'responsable' | null>>({
    'Nuevo': null,
    'Contactado': null,
    'Cotizado': null,
    'Negociación': null,
    'Cerrado Ganado': null,
    'Cerrado Perdido': null,
  });

  // Kanban filters states
  const [kanbanFilterResponsable, setKanbanFilterResponsable] = useState<string>('All');
  const [kanbanFilterTemperature, setKanbanFilterTemperature] = useState<string>('All');
  const [kanbanFilterClient, setKanbanFilterClient] = useState<string>('All');
  const [kanbanMiKanbanOnly, setKanbanMiKanbanOnly] = useState<boolean>(false);

  // Active drawer card ID
  const [activeDrawerRecordId, setActiveDrawerRecordId] = useState<string | null>(null);

  // States for interactive timeline log entry
  const [newFollowupNotes, setNewFollowupNotes] = useState('');
  const [newFollowupMethod, setNewFollowupMethod] = useState('Llamada Telefónica');
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);
  const [editingFollowupNotes, setEditingFollowupNotes] = useState<string>('');

  // HTML5 Drag states / close modal states
  const [pendingDrag, setPendingDrag] = useState<{
    recordId: string;
    targetStage: string;
    sourceStage: string;
  } | null>(null);
  const [closeReason, setCloseReason] = useState<string>('Ganado por precio');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // Persist VIP limits & meta on changes
  useEffect(() => {
    localStorage.setItem('verse_crm_kanban_wip_limits', JSON.stringify(wipLimits));
  }, [wipLimits]);

  useEffect(() => {
    localStorage.setItem('verse_crm_kanban_columns', JSON.stringify(kanbanColumns));
  }, [kanbanColumns]);

  useEffect(() => {
    localStorage.setItem('verse_crm_kanban_meta', JSON.stringify(kanbanMeta));
  }, [kanbanMeta]);

  const [draftRecord, setDraftRecord] = useState<CRMRecord | null>(null);
  const [draftMeta, setDraftMeta] = useState<KanbanMeta | null>(null);

  useEffect(() => {
    if (activeDrawerRecordId) {
      const card = records.find(r => r.id === activeDrawerRecordId);
      if (card) {
        const cloned = JSON.parse(JSON.stringify(card));
        if (cloned.acciones_seguimiento) {
          cloned.acciones_seguimiento = cloned.acciones_seguimiento.map((item: any, fIdx: number) => ({
            id: item.id || `f-${fIdx}-${Date.now()}`,
            fecha: item.fecha || getMexicoCityDateString(),
            tipo: item.tipo || 'Llamada Telefónica',
            creador: item.creador || 'Geovanni Andrade',
            notas: item.notas || ''
          }));
        }
        setDraftRecord(cloned);

        const existingMeta = kanbanMeta[activeDrawerRecordId];
        const meta: KanbanMeta = existingMeta || {
          stage: card.etapa || 'Nuevo',
          dateEnteredStage: card.fecha_cambio_etapa || card.fecha_registro || getMexicoCityDateString(),
          responsable: card.responsable || '',
          subtasks: Array.isArray(card.__tareas) ? card.__tareas : [],
          tags: card.tags ? card.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          stagnation_days_limit: card.stagnation_days_limit !== undefined && card.stagnation_days_limit !== null ? Number(card.stagnation_days_limit) : 5
        };
        setDraftMeta(JSON.parse(JSON.stringify(meta)));
      }
    } else {
      setDraftRecord(null);
      setDraftMeta(null);
    }
  }, [activeDrawerRecordId, records, kanbanMeta]);

  // Helper to map a standard/default stage name to the corresponding customized/active column in kanbanColumns
  const resolveStageName = (defaultStage: string): string => {
    if (kanbanColumns.includes(defaultStage)) return defaultStage;

    const defaultIndexMap: Record<string, number> = {
      'Nuevo': 0,
      'Contactado': 1,
      'Cotizado': 2,
      'Negociación': 3,
      'Cerrado Ganado': 4,
      'Cerrado Perdido': 5
    };

    const idx = defaultIndexMap[defaultStage];
    if (idx !== undefined && kanbanColumns[idx]) {
      return kanbanColumns[idx];
    }

    if (defaultStage === 'Cerrado Ganado') {
      const found = kanbanColumns.find(c => c.toLowerCase().includes('ganado'));
      if (found) return found;
    }
    if (defaultStage === 'Cerrado Perdido') {
      const found = kanbanColumns.find(c => c.toLowerCase().includes('perdido'));
      if (found) return found;
    }

    return kanbanColumns[0] || defaultStage;
  };

  // Helper to map a customized/active column name back to its standard/default equivalent
  const getDefaultStageForCustom = (customStage: string): string => {
    const defaultStages = ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
    if (defaultStages.includes(customStage)) return customStage;

    const idx = kanbanColumns.indexOf(customStage);
    if (idx !== -1 && idx < defaultStages.length) {
      return defaultStages[idx];
    }

    if (customStage.toLowerCase().includes('ganado')) return 'Cerrado Ganado';
    if (customStage.toLowerCase().includes('perdido')) return 'Cerrado Perdido';
    if (customStage.toLowerCase().includes('negoc')) return 'Negociación';
    if (customStage.toLowerCase().includes('cotiz') || customStage.toLowerCase().includes('lead')) return 'Cotizado';
    if (customStage.toLowerCase().includes('contact')) return 'Contactado';
    if (customStage.toLowerCase().includes('prospect') || customStage.toLowerCase().includes('nuev')) return 'Nuevo';

    return customStage;
  };

  // Synchronise existing master list records with the Kanban system with smart automatic movements
  useEffect(() => {
    if (records.length > 0) {
      let anyChange = false;
      const updatedMeta = { ...kanbanMeta };
      
      const mockResponsables = RESPONSIBLES;
      const mockTags = ['Renovación', 'Riesgo', 'SAT / ISO', 'Urgente', 'B2B Tech', 'SaaS', 'Planta Crítica'];

      records.forEach((r, idx) => {
        const currentMeta = updatedMeta[r.id];
        let defaultTarget: string | null = null;

        // 1. Determine the expected default stage based on r.etapa, or r.estado_proyecto & r.status_proyecto
        if (r.etapa && kanbanColumns.includes(r.etapa)) {
          defaultTarget = r.etapa;
        } else if (r.estado_proyecto === 'Cerrado Ganado') {
          defaultTarget = 'Cerrado Ganado';
        } else if (r.estado_proyecto === 'Negociación') {
          defaultTarget = 'Negociación';
        } else if (r.estado_proyecto === 'Propuesta') {
          // If in proposal, sub-segment based on financial data availability
          if (r.total_hardware_cotizacion !== null && r.total_hardware_cotizacion !== undefined && Number(r.total_hardware_cotizacion) > 0) {
            defaultTarget = 'Cotizado';
          } else if (r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion !== 'https://drive.google.com/file/d/new_quote_ref' && r.informacion_general_link_cotizacion !== '') {
            defaultTarget = 'Cotizado';
          } else if (r.status_proyecto === 'Warm') {
            defaultTarget = 'Contactado';
          } else {
            // Keep current stage if it's already the custom version of 'Nuevo', 'Contactado', or 'Cotizado'
            const customNuevo = resolveStageName('Nuevo');
            const customContactado = resolveStageName('Contactado');
            const customCotizado = resolveStageName('Cotizado');
            if (currentMeta?.stage === customNuevo || currentMeta?.stage === customContactado || currentMeta?.stage === customCotizado) {
              defaultTarget = getDefaultStageForCustom(currentMeta.stage);
            } else {
              defaultTarget = 'Nuevo';
            }
          }
        } else if (r.estado_proyecto === null || r.estado_proyecto === undefined) {
          if (r.status_proyecto === 'Win') defaultTarget = 'Cerrado Ganado';
          else if (r.status_proyecto === 'Hot') defaultTarget = 'Negociación';
          else if (r.status_proyecto === 'Warm') defaultTarget = 'Contactado';
          else if (r.status_proyecto === 'Cool') defaultTarget = 'Nuevo';
          else {
            if (currentMeta?.stage) {
              defaultTarget = getDefaultStageForCustom(currentMeta.stage);
            } else {
              defaultTarget = 'Nuevo';
            }
          }
        }

        // Apply fallback if still null
        if (!defaultTarget) defaultTarget = 'Nuevo';

        // Resolve default stage to active custom column name
        const targetStage = resolveStageName(defaultTarget);

        // Parse checklist_tasks from DB
        let dbSubtasks: any[] | null = null;
        if (r.checklist_tasks) {
          const parsed = safeJsonParse<any[] | null>(r.checklist_tasks, null, 'checklist_tasks');
          if (Array.isArray(parsed)) {
            dbSubtasks = parsed.map((item: any, sidx: number) => ({
              id: item.id || `s-db-${idx}-${sidx}-${Date.now()}`,
              text: String(item.text || ''),
              completed: !!item.completed
            }));
          }
        }

        // Parse tags from DB
        let dbTags: string[] | null = null;
        if (r.tags) {
          const parsed = safeJsonParse<any[] | null>(r.tags, null, 'tags');
          if (Array.isArray(parsed)) {
            dbTags = parsed.map(String);
          } else {
            dbTags = String(r.tags).split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
          }
        }

        const resolvedResponsable = r.responsable || null;
        const resolvedDateEntered = r.fecha_cambio_etapa || r.fecha_registro || getMexicoCityDateString();
        const resolvedStagnationLimit = r.stagnation_days_limit !== undefined && r.stagnation_days_limit !== null ? Number(r.stagnation_days_limit) : 5;

        // 2. If it's a completely new card in kanbanMeta
        if (!currentMeta) {
          updatedMeta[r.id] = {
            stage: targetStage,
            dateEnteredStage: resolvedDateEntered,
            responsable: resolvedResponsable,
            subtasks: dbSubtasks || [],
            tags: dbTags || [],
            stagnation_days_limit: resolvedStagnationLimit
          };
          anyChange = true;
        } else {
          // 3. For existing cards, check if DB state changed or we need to update
          let metaChanged = false;
          const newMetaState = { ...currentMeta };

          if (currentMeta.stage !== targetStage) {
            newMetaState.stage = targetStage;
            newMetaState.dateEnteredStage = resolvedDateEntered;
            metaChanged = true;
          }
          if (r.responsable && currentMeta.responsable !== r.responsable) {
            newMetaState.responsable = r.responsable;
            metaChanged = true;
          }
          if (dbSubtasks && JSON.stringify(currentMeta.subtasks) !== JSON.stringify(dbSubtasks)) {
            newMetaState.subtasks = dbSubtasks;
            metaChanged = true;
          }
          if (dbTags && JSON.stringify(currentMeta.tags) !== JSON.stringify(dbTags)) {
            newMetaState.tags = dbTags;
            metaChanged = true;
          }
          if (r.stagnation_days_limit !== undefined && r.stagnation_days_limit !== null && currentMeta.stagnation_days_limit !== resolvedStagnationLimit) {
            newMetaState.stagnation_days_limit = resolvedStagnationLimit;
            metaChanged = true;
          }

          if (metaChanged) {
            updatedMeta[r.id] = newMetaState;
            anyChange = true;
          }
        }
      });

      if (anyChange) {
        setKanbanMeta(updatedMeta);
      }
    }
  }, [records, kanbanColumns]);

  // Advanced Filter states
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [pageSize, setPageSize] = useState<number | 'Todos'>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [yearFilter, setYearFilter] = useState('All');
  const [quarterFilter, setQuarterFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<CRMRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form Fields
  const [formId, setFormId] = useState('');
  const [formFolio, setFormFolio] = useState('');
  const [formCliente, setFormCliente] = useState('');
  const [formPlanta, setFormPlanta] = useState('');
  const [formPais, setFormPais] = useState('México');
  const [formUbicacion, setFormUbicacion] = useState('');
  const [formProyecto, setFormProyecto] = useState('');
  const [formLinkCotizacion, setFormLinkCotizacion] = useState('');
  const [formHardware, setFormHardware] = useState<number | ''>('');
  const [formServicios, setFormServicios] = useState<number | ''>('');
  const [formMoneda, setFormMoneda] = useState<'USD' | 'MXN'>('USD');
  const [formStatus, setFormStatus] = useState<'Propuesta' | 'Negociación' | 'Cerrado Ganado' | null>(null);
  const [formNotas, setFormNotas] = useState('');
  const [formSustituye, setFormSustituye] = useState('');
  
  // Excel-like Column Sort & Filter states
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>('');
  
  // Custom modal states for delete confirmation and PDF trigger
  const [pdfPromptOpen, setPdfPromptOpen] = useState(false);
  const [pdfPromptRecord, setPdfPromptRecord] = useState<CRMRecord | null>(null);
  
  // Real-time calculated values
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);

  // Auto Calculations - Deactivated 16% VAT auto-calculation to preserve exact quote amounts
  useEffect(() => {
    const hw = formHardware === '' ? 0 : Number(formHardware);
    const serv = formServicios === '' ? 0 : Number(formServicios);
    const calculatedSubtotal = hw + serv;
    const calculatedIva = 0;
    const calculatedTotal = calculatedSubtotal;
    
    setSubtotal(calculatedSubtotal);
    setIva(calculatedIva);
    setTotal(calculatedTotal);
  }, [formHardware, formServicios]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTabFilter, yearFilter, quarterFilter, regionFilter, startDateFilter, endDateFilter, colFilters]);

  // Open Form for creating
  const handleOpenCreateMode = () => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueado el alta de registros.`);
      return;
    }
    setActiveDrawerRecordId(null);
    setPendingDrag(null);
    setIsEditing(false);
    setFormId('');
    // Auto increment default folio
    const nextNum = records.length + 1200 + Math.floor(Math.random() * 10);
    setFormFolio(`VT-${nextNum}`);
    setFormCliente('');
    setFormPlanta('');
    setFormPais('México');
    setFormUbicacion('');
    setFormProyecto('');
    setFormLinkCotizacion('');
    setFormHardware(0);
    setFormServicios(0);
    setFormMoneda('USD');
    setFormStatus(null);
    setFormNotas('');
    setFormSustituye('');
    setIsFormOpen(true);
  };

  // Open Advanced Sliding Drawer for editing
  const handleOpenEditMode = (rec: CRMRecord) => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueada la edición.`);
      return;
    }
    setActiveDrawerRecordId(rec.id);
  };

  // Delete Action triggered by clicking the trash button
  const handleDelete = (id: string, folio: string) => {
    if (role !== 'Admin') {
      alert(`🔒 Acción Bloqueada: El rol actual "${role}" no tiene privilegios para eliminar folios definitivos.`);
      return;
    }
    setPendingDrag({ recordId: id, targetStage: '', sourceStage: '', type: 'delete' });
  };

  const handleConfirmDeleteActual = () => {
    if (pendingDrag && pendingDrag.type === 'delete') {
      const recordId = pendingDrag.recordId;
      const r = records.find(rec => rec.id === recordId);
      if (r) {
        const extraInfo = r.informacion_general_cliente || r.informacion_general_proyecto
          ? ` (${r.informacion_general_cliente || 'N/A'} - ${r.informacion_general_proyecto || 'N/A'})`
          : '';
        onDeleteRecord(recordId);
        onShowAudit('ELIMINACIÓN', `Eliminó registro comercial con Folio ${r.informacion_general_folio}${extraInfo} permanentemente.`);
      }
      setPendingDrag(null);
    }
  };

  // View detail
  const handleOpenDetail = (rec: CRMRecord) => {
    setSelectedRecord(rec);
    setIsDetailOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCliente || !formProyecto || !formPlanta) {
      alert("Por favor, complete todos los campos mandatorios (Cliente, Planta, Proyecto).");
      return;
    }

    const existingRec = isEditing ? records.find(r => r.id === formId) : null;
    let nextStatusProyecto = existingRec?.status_proyecto || null;
    if (formStatus === 'Cerrado Ganado') {
      nextStatusProyecto = 'Win';
    } else if (formStatus === 'Negociación') {
      if (nextStatusProyecto !== 'Hot' && nextStatusProyecto !== 'Warm') {
        nextStatusProyecto = 'Warm';
      }
    } else if (formStatus === 'Propuesta') {
      if (nextStatusProyecto !== 'Cool') {
        nextStatusProyecto = 'Cool';
      }
    } else if (formStatus === null) {
      nextStatusProyecto = null;
    }

    const payload: CRMRecord = {
      id: formId || toValidUUID(`rec-${formFolio.toUpperCase().trim()}`),
      informacion_general_folio: formFolio || null,
      fecha_registro: existingRec?.fecha_registro || getMexicoCityDateString(),
      informacion_general_cliente: formCliente || null,
      informacion_general_planta: formPlanta || null,
      cliente_pais: formPais || null,
      cliente_ubicacion: formUbicacion || null,
      informacion_general_proyecto: formProyecto || null,
      informacion_general_link_cotizacion: formLinkCotizacion || null,
      total_hardware_cotizacion: formHardware === '' ? null : Number(formHardware),
      total_servicios_cotizacion: formServicios === '' ? null : Number(formServicios),
      total_subtotal_cotizacion: (formHardware === '' && formServicios === '') ? null : subtotal,
      total_iva_cotizacion: (formHardware === '' && formServicios === '') ? null : iva,
      total_general_cotizacion: (formHardware === '' && formServicios === '') ? null : total,
      informacion_general_moneda: formMoneda,
      estado_proyecto: formStatus || null,
      status_proyecto: nextStatusProyecto || null,
      notas_comerciales: formNotas || null,
      acciones_seguimiento: isEditing 
        ? (existingRec?.acciones_seguimiento || []) 
        : [],
      sustituye_folio_anterior: formSustituye || null,
      link_orden_compra: existingRec?.link_orden_compra || null,
      folio_orden_compra: existingRec?.folio_orden_compra || null,
      fecha_inicio_proyecto: existingRec?.fecha_inicio_proyecto || null,
      informacion_general_instalacion_incluida: existingRec?.informacion_general_instalacion_incluida ?? undefined,

      // NUEVOS CAMPOS INDEPENDIENTES
      etapa: existingRec?.etapa || (formStatus ? resolveStageName(formStatus) : 'Nuevo'),
      nivel_termo: nextStatusProyecto || null,
      prioridad: existingRec?.prioridad ?? 0,
      estado: formStatus || null,
      
      // Preservar metadatos al editar desde este formulario
      fecha_cambio_etapa: existingRec?.fecha_cambio_etapa || null,
      stagnation_days_limit: existingRec?.stagnation_days_limit || 5,
      checklist_tasks: existingRec?.checklist_tasks || null,
      __tareas: existingRec?.__tareas || [],
      contacto_asignado_id: existingRec?.contacto_asignado_id || null,
      responsable: existingRec?.responsable || null,
      tags: existingRec?.tags || null
    };

    if (isEditing) {
      onUpdateRecord(payload);
      const changes: string[] = [];
      if (existingRec) {
        if (existingRec.informacion_general_cliente !== payload.informacion_general_cliente) {
          changes.push(`Cliente: "${existingRec.informacion_general_cliente || 'Sin asignar'}" ➔ "${payload.informacion_general_cliente || 'Sin asignar'}"`);
        }
        if (existingRec.informacion_general_planta !== payload.informacion_general_planta) {
          changes.push(`Planta: "${existingRec.informacion_general_planta || 'Sin asignar'}" ➔ "${payload.informacion_general_planta || 'Sin asignar'}"`);
        }
        if (existingRec.informacion_general_proyecto !== payload.informacion_general_proyecto) {
          changes.push(`Proyecto: "${existingRec.informacion_general_proyecto || 'Sin asignar'}" ➔ "${payload.informacion_general_proyecto || 'Sin asignar'}"`);
        }
        if (existingRec.cliente_pais !== payload.cliente_pais) {
          changes.push(`País: "${existingRec.cliente_pais || 'Sin asignar'}" ➔ "${payload.cliente_pais || 'Sin asignar'}"`);
        }
        if (existingRec.cliente_ubicacion !== payload.cliente_ubicacion) {
          changes.push(`Ubicación: "${existingRec.cliente_ubicacion || 'Sin asignar'}" ➔ "${payload.cliente_ubicacion || 'Sin asignar'}"`);
        }
        if (existingRec.total_hardware_cotizacion !== payload.total_hardware_cotizacion) {
          changes.push(`Hardware: $${existingRec.total_hardware_cotizacion} ➔ $${payload.total_hardware_cotizacion}`);
        }
        if (existingRec.total_servicios_cotizacion !== payload.total_servicios_cotizacion) {
          changes.push(`Servicios: $${existingRec.total_servicios_cotizacion} ➔ $${payload.total_servicios_cotizacion}`);
        }
        if (existingRec.informacion_general_moneda !== payload.informacion_general_moneda) {
          changes.push(`Moneda: ${existingRec.informacion_general_moneda} ➔ ${payload.informacion_general_moneda}`);
        }
        if (existingRec.estado_proyecto !== payload.estado_proyecto) {
          changes.push(`Estado: "${existingRec.estado_proyecto || 'Sin asignar'}" ➔ "${payload.estado_proyecto || 'Sin asignar'}"`);
        }
        if (existingRec.sustituye_folio_anterior !== payload.sustituye_folio_anterior) {
          changes.push(`Sustituye Folio: "${existingRec.sustituye_folio_anterior || 'Sin asignar'}" ➔ "${payload.sustituye_folio_anterior || 'Sin asignar'}"`);
        }
        if (existingRec.informacion_general_link_cotizacion !== payload.informacion_general_link_cotizacion) {
          changes.push(`Link de cotización actualizado`);
        }
        if (existingRec.notas_comerciales !== payload.notas_comerciales) {
          changes.push(`Notas comerciales actualizadas`);
        }
      }
      const descCambios = changes.length > 0 
        ? `, Cambios: [${changes.join(' | ')}]`
        : ' (Sin cambios significativos)';
      onShowAudit('MODIFICACIÓN', `Actualizó expediente comercial de ${formCliente} (Folio ${formFolio})${descCambios}`);
    } else {
      onAddRecord(payload);
      onShowAudit('ALTA REGISTRO', `Creó nueva oferta para ${formCliente} (Folio ${formFolio}). Detalle inicial: Proyecto: "${formProyecto}", Planta: "${formPlanta}", Ubicación: "${formUbicacion || 'Sin especificar'}", Monto: $${total} ${formMoneda}, Estado: "${formStatus || 'Sin especificar'}"`);
    }

    setIsFormOpen(false);
  };

  // Helper functions for advanced filters
  const getQuarter = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 3) return 'Q1';
    if (m >= 4 && m <= 6) return 'Q2';
    if (m >= 7 && m <= 9) return 'Q3';
    if (m >= 10 && m <= 12) return 'Q4';
    return '';
  };

  const getTemperature = (r: CRMRecord) => {
    // Retorna directamente status_proyecto que almacena la prioridad/temperatura
    if (r.status_proyecto === 'Win') return 'Win';
    if (r.status_proyecto === 'Hot') return 'Hot';
    if (r.status_proyecto === 'Warm') return 'Warm';
    if (r.status_proyecto === 'Cool') return 'Cool';
    return (r.status_proyecto || null) as 'Win' | 'Hot' | 'Warm' | 'Cool' | null;
  };

  const getRegionGroup = (r: CRMRecord) => {
    const pais = (r.cliente_pais || '').toLowerCase();
    const ub = (r.cliente_ubicacion || '').toLowerCase();
    const plant = (r.informacion_general_planta || '').toLowerCase();
    
    if (pais.includes('ee.uu') || pais.includes('usa') || ub.includes('texas') || ub.includes('detroit') || ub.includes('estados unidos')) {
      return 'EE.UU.';
    }
    if (pais.includes('costa rica') || pais.includes('latam') || ub.includes('cr') || ub.includes('costa') || ub.includes('guatemala')) {
      return 'LATAM';
    }
    if (ub.includes('cdmx') || ub.includes('df') || ub.includes('mex') || ub.includes('toluca') || plant.includes('toluca') || plant.includes('estado de mexico') || plant.includes('edomex')) {
      return 'Centro';
    }
    if (ub.includes('jal') || ub.includes('guadalajara') || plant.includes('guadalajara')) {
      return 'Occidente';
    }
    if (ub.includes('guanajuato') || ub.includes('silao') || plant.includes('silao')) {
      return 'Bajío';
    }
    if (ub.includes('zacatecas') || ub.includes('monterrey') || ub.includes('mty') || ub.includes('nuevo leon')) {
      return 'Norte';
    }
    return 'Otro';
  };

  const getAmountGroup = (r: CRMRecord) => {
    let valueUSD = r.total_general_cotizacion;
    if (r.informacion_general_moneda === 'MXN') {
      valueUSD = r.total_general_cotizacion / exchangeRate; // Dynamic B2B Exchange Rate from App.tsx
    }
    if (valueUSD < 15000) return 'low';
    if (valueUSD >= 15000 && valueUSD <= 50000) return 'medium';
    return 'high';
  };

  // Extract unique filter lists
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.informacion_general_cliente).filter((c): c is string => !!c)));
  }, [records]);

  const uniquePlants = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.informacion_general_planta).filter((p): p is string => !!p)));
  }, [records]);

  // Extract dynamic unique years list from records
  const uniqueYears = useMemo(() => {
    return Array.from(
      new Set(
        records
          .map((r) => (r.fecha_registro ? r.fecha_registro.substring(0, 4) : ''))
          .filter(Boolean)
      )
    ).sort();
  }, [records]);

  // Base filtration matching original top-bar custom selectors
  const baseFiltered = useMemo(() => {
    return records.filter((r) => {
      // 1. General search
      const matchesSearch =
        !searchTerm ? true : (
          (r.informacion_general_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.informacion_general_proyecto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.informacion_general_folio || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.informacion_general_planta || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

      // 3. Tab filter (All, Activos, Cerrados)
      let matchesTab = true;
      if (activeTabFilter === 'active') {
        matchesTab = r.estado_proyecto === 'Propuesta' || r.estado_proyecto === 'Negociación';
      } else if (activeTabFilter === 'closed') {
        matchesTab = r.estado_proyecto === 'Cerrado Ganado';
      }

      // 4. Year, Quarter, Date range
      const recordYear = r.fecha_registro ? r.fecha_registro.substring(0, 4) : '';
      const recordQuarter = getQuarter(r.fecha_registro);
      
      const matchesYear = yearFilter === 'All' || recordYear === yearFilter;
      const matchesQuarter = quarterFilter === 'All' || recordQuarter === quarterFilter;

      let matchesDateRange = true;
      if (startDateFilter && r.fecha_registro) {
        matchesDateRange = matchesDateRange && (r.fecha_registro >= startDateFilter);
      }
      if (endDateFilter && r.fecha_registro) {
        matchesDateRange = matchesDateRange && (r.fecha_registro <= endDateFilter);
      }

      // 6. Region
      const recordRegion = getRegionGroup(r);
      const matchesRegion = regionFilter === 'All' || recordRegion === regionFilter;

      return (
        matchesSearch &&
        matchesTab &&
        matchesYear &&
        matchesQuarter &&
        matchesDateRange &&
        matchesRegion
      );
    });
  }, [records, searchTerm, activeTabFilter, yearFilter, quarterFilter, startDateFilter, endDateFilter, regionFilter]);

  // Apply Excel dynamic column filters
  const filteredRecords = useMemo(() => {
    return baseFiltered.filter((r) => {
      for (const colKey of Object.keys(colFilters)) {
        const activeValues = colFilters[colKey];
        if (!activeValues || activeValues.length === 0) continue;
        
        let val: any = null;
        if (colKey === 'folio') val = r.informacion_general_folio;
        else if (colKey === 'client') val = r.informacion_general_cliente;
        else if (colKey === 'plant') val = r.informacion_general_planta;
        else if (colKey === 'project') val = r.informacion_general_proyecto;
        else if (colKey === 'amount') {
          val = r.total_general_cotizacion.toLocaleString('en-US', {
            style: 'currency',
            currency: r.informacion_general_moneda,
            minimumFractionDigits: 0
          });
        }
        else if (colKey === 'stage') val = kanbanMeta[r.id]?.stage || resolveStageName('Nuevo');
        else if (colKey === 'responsable') val = kanbanMeta[r.id]?.responsable || r.responsable;
        else if (colKey === 'status') val = r.estado_proyecto;
        else if (colKey === 'level') val = getTemperature(r);
        else if (colKey === 'actions_followup') val = r.acciones_seguimiento?.[0]?.notas;
        else if (colKey === 'actions_history') val = r.acciones_seguimiento?.length ? `${r.acciones_seguimiento.length} acciones` : null;
        else if (colKey === 'checklist_progress') {
          const meta = kanbanMeta[r.id];
          let subtasks = [];
          if (meta && meta.subtasks) {
            subtasks = meta.subtasks;
          } else if (r.checklist_tasks) {
            subtasks = safeJsonParse<any[]>(r.checklist_tasks, [], 'checklist_tasks');
          }
          const completed = subtasks.filter((s: any) => s.completed).length;
          val = subtasks.length > 0 ? `${completed}/${subtasks.length} tareas` : null;
        }

        let labelToCheck = '';
        if (val === null || val === undefined || String(val).trim() === '') {
          labelToCheck = 'null y campos faltantes';
        } else {
          labelToCheck = String(val).trim();
        }

        if (!activeValues.includes(labelToCheck)) {
          return false;
        }
      }
      return true;
    });
  }, [baseFiltered, colFilters, kanbanMeta]);

  // Unique column values based on full pool of records
  const getUniqueColumnValues = (colKey: string) => {
    const rawValues = records.map((r) => {
      let val: any = null;
      if (colKey === 'folio') val = r.informacion_general_folio;
      else if (colKey === 'client') val = r.informacion_general_cliente;
      else if (colKey === 'plant') val = r.informacion_general_planta;
      else if (colKey === 'project') val = r.informacion_general_proyecto;
      else if (colKey === 'amount') {
        return r.total_general_cotizacion.toLocaleString('en-US', {
          style: 'currency',
          currency: r.informacion_general_moneda,
          minimumFractionDigits: 0
        });
      }
      else if (colKey === 'stage') val = kanbanMeta[r.id]?.stage || resolveStageName('Nuevo');
      else if (colKey === 'responsable') val = kanbanMeta[r.id]?.responsable || r.responsable;
      else if (colKey === 'status') val = r.estado_proyecto;
      else if (colKey === 'level') val = getTemperature(r);
      else if (colKey === 'actions_followup') val = r.acciones_seguimiento?.[0]?.notas;
      else if (colKey === 'actions_history') val = r.acciones_seguimiento?.length ? `${r.acciones_seguimiento.length} acciones` : null;
      else if (colKey === 'checklist_progress') {
        const meta = kanbanMeta[r.id];
        let subtasks = [];
        if (meta && meta.subtasks) {
          subtasks = meta.subtasks;
        } else if (r.checklist_tasks) {
          subtasks = safeJsonParse<any[]>(r.checklist_tasks, [], 'checklist_tasks');
        }
        const completed = subtasks.filter((s: any) => s.completed).length;
        val = subtasks.length > 0 ? `${completed}/${subtasks.length} tareas` : null;
      }

      if (val === null || val === undefined || String(val).trim() === '') {
        return 'null y campos faltantes';
      }
      return String(val).trim();
    });

    const sortedVals = Array.from(new Set(rawValues)).sort((a, b) => {
      if (a === 'null y campos faltantes') return -1;
      if (b === 'null y campos faltantes') return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sortedVals;
  };

  const getUniqueColValuesFiltered = (colKey: string) => {
    const vals = getUniqueColumnValues(colKey);
    if (!filterSearch) return vals;
    return vals.filter(v => v.toLowerCase().includes(filterSearch.toLowerCase()));
  };

  const toggleDropdown = (colKey: string) => {
    if (activeDropdown === colKey) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(colKey);
      setFilterSearch('');
    }
  };

  const handleHeaderClick = (colKey: string) => {
    setActiveDropdown(null);
    if (sortColumn === colKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  const clearColumnFilter = (colKey: string) => {
    setColFilters(prev => {
      const copy = { ...prev };
      delete copy[colKey];
      return copy;
    });
  };

  const isAllSelectedForCol = (colKey: string) => {
    return !colFilters[colKey] || colFilters[colKey].length === 0;
  };

  const handleToggleSelectAllCol = (colKey: string, checked: boolean) => {
    if (checked) {
      clearColumnFilter(colKey);
    } else {
      setColFilters(prev => ({
        ...prev,
        [colKey]: []
      }));
    }
  };

  const isColValChecked = (colKey: string, val: string) => {
    const activeVals = colFilters[colKey];
    if (!activeVals) return true;
    return activeVals.includes(val);
  };

  const handleToggleValChecked = (colKey: string, val: string) => {
    setColFilters(prev => {
      const activeVals = prev[colKey];
      const allUnique = getUniqueColumnValues(colKey);
      
      let nextVals: string[];
      if (!activeVals) {
        nextVals = allUnique.filter(item => item !== val);
      } else {
        if (activeVals.includes(val)) {
          nextVals = activeVals.filter(item => item !== val);
        } else {
          nextVals = [...activeVals, val];
        }
      }
      
      const copy = { ...prev };
      if (nextVals.length === allUnique.length) {
        delete copy[colKey];
      } else {
        copy[colKey] = nextVals;
      }
      return copy;
    });
  };

  // Excel-like Sorting logic
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      if (!sortColumn) return 0;
      
      let valA: any = '';
      let valB: any = '';
      
      if (sortColumn === 'folio') {
        valA = a.informacion_general_folio || '';
        valB = b.informacion_general_folio || '';
      } else if (sortColumn === 'client') {
        valA = a.informacion_general_cliente || '';
        valB = b.informacion_general_cliente || '';
      } else if (sortColumn === 'plant') {
        valA = a.informacion_general_planta || '';
        valB = b.informacion_general_planta || '';
      } else if (sortColumn === 'project') {
        valA = a.informacion_general_proyecto || '';
        valB = b.informacion_general_proyecto || '';
      } else if (sortColumn === 'amount') {
        const getUSD = (rec: CRMRecord) => {
          let val = rec.total_general_cotizacion;
          if (rec.informacion_general_moneda === 'MXN') {
            val = rec.total_general_cotizacion / exchangeRate;
          }
          return val;
        };
        valA = getUSD(a);
        valB = getUSD(b);
      } else if (sortColumn === 'status') {
        valA = a.estado_proyecto || '';
        valB = b.estado_proyecto || '';
      } else if (sortColumn === 'stage') {
        valA = kanbanMeta[a.id]?.stage || resolveStageName('Nuevo');
        valB = kanbanMeta[b.id]?.stage || resolveStageName('Nuevo');
      } else if (sortColumn === 'responsable') {
        valA = kanbanMeta[a.id]?.responsable || a.responsable || '';
        valB = kanbanMeta[b.id]?.responsable || b.responsable || '';
      } else if (sortColumn === 'level') {
        const getPriorityValue = (temp: string) => {
          if (temp === 'Win') return 4;
          if (temp === 'Hot') return 3;
          if (temp === 'Warm') return 2;
          return 1;
        };
        valA = getPriorityValue(getTemperature(a));
        valB = getPriorityValue(getTemperature(b));
      } else if (sortColumn === 'actions_followup') {
        valA = a.acciones_seguimiento?.[0]?.notas || '';
        valB = b.acciones_seguimiento?.[0]?.notas || '';
      } else if (sortColumn === 'actions_history') {
        valA = a.acciones_seguimiento?.length || 0;
        valB = b.acciones_seguimiento?.length || 0;
      } else if (sortColumn === 'checklist_progress') {
        const getPct = (rec: CRMRecord) => {
          const meta = kanbanMeta[rec.id];
          let subtasks = [];
          if (meta && meta.subtasks) {
            subtasks = meta.subtasks;
          } else if (rec.checklist_tasks) {
            subtasks = safeJsonParse<any[]>(rec.checklist_tasks, [], 'checklist_tasks');
          }
          const total = subtasks.length;
          if (total === 0) return 0;
          const completed = subtasks.filter((s: any) => s.completed).length;
          return completed / total;
        };
        valA = getPct(a);
        valB = getPct(b);
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc'
          ? (valA > valB ? 1 : valA < valB ? -1 : 0)
          : (valB > valA ? 1 : valB < valA ? -1 : 0);
      }
    });
  }, [filteredRecords, sortColumn, sortDirection, kanbanMeta]);

  const paginatedRecords = useMemo(() => {
    return pageSize === 'Todos'
      ? sortedRecords
      : sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedRecords, pageSize, currentPage]);

  // Calculate dynamic summary stats for search matching
  const totalCotizacionesUSD = useMemo(() => {
    const sum = filteredRecords.reduce((acc, r) => {
      let val = r.total_general_cotizacion;
      if (r.informacion_general_moneda === 'MXN') {
        val = r.total_general_cotizacion / exchangeRate;
      }
      return acc + val;
    }, 0);
    return safeRound(sum);
  }, [filteredRecords, exchangeRate]);

  const totalActivoUSD = useMemo(() => {
    const sum = filteredRecords
      .filter((r) => r.estado_proyecto !== 'Cerrado Ganado')
      .reduce((acc, r) => {
        let val = r.total_general_cotizacion;
        if (r.informacion_general_moneda === 'MXN') {
          val = r.total_general_cotizacion / exchangeRate;
        }
        return acc + val;
      }, 0);
    return safeRound(sum);
  }, [filteredRecords, exchangeRate]);

  const averageQuotaUSD = useMemo(() => {
    return filteredRecords.length > 0 ? safeRound(totalCotizacionesUSD / filteredRecords.length) : 0;
  }, [filteredRecords, totalCotizacionesUSD]);

  // helper to lock precise column widths across headers & row metrics
  const getColWidthClass = (colKey: string) => {
    if (colKey === 'folio') return 'w-[6%] min-w-[70px] max-w-[85px]';
    if (colKey === 'client') return 'w-[10%] min-w-[95px] max-w-[115px]';
    if (colKey === 'plant') return 'w-[10%] min-w-[95px] max-w-[115px]';
    if (colKey === 'project') return 'w-[13%] min-w-[125px] max-w-[160px]';
    if (colKey === 'amount') return 'w-[8%] min-w-[80px] max-w-[95px]';
    if (colKey === 'stage') return 'w-[8%] min-w-[85px] max-w-[100px]';
    if (colKey === 'responsable') return 'w-[8%] min-w-[85px] max-w-[100px]';
    if (colKey === 'status') return 'w-[8%] min-w-[85px] max-w-[100px]';
    if (colKey === 'level') return 'w-[6%] min-w-[75px] max-w-[90px]';
    if (colKey === 'actions_followup') return 'w-[10%] min-w-[100px] max-w-[125px]';
    if (colKey === 'actions_history') return 'w-[10%] min-w-[100px] max-w-[125px]';
    if (colKey === 'checklist_progress') return 'w-[8%] min-w-[85px] max-w-[105px]';
    return '';
  };

  // Render Header Cell Helper with embedded dropdown
  const renderHeaderCell = (colKey: string, label: string, alignment?: 'right' | 'center') => {
    const isFiltered = colFilters[colKey] && colFilters[colKey].length > 0;
    const isSorted = sortColumn === colKey;
    const wClass = getColWidthClass(colKey);
    
    return (
      <th className={`p-2.5 px-3 font-bold relative group/head ${wClass} ${
        alignment === 'right' ? 'text-right' : alignment === 'center' ? 'text-center' : 'text-left'
      }`}>
        <div className={`flex items-center gap-1 w-full ${
          alignment === 'right' ? 'justify-end' : alignment === 'center' ? 'justify-center' : 'justify-between'
        }`}>
          <button
            type="button"
            onClick={() => handleHeaderClick(colKey)} 
            className="hover:text-slate-800 transition-colors flex items-center gap-1 font-semibold outline-none py-1.5 leading-none transition-all text-left"
          >
            <span>{label}</span>
            {isSorted && (
              sortDirection === 'asc' 
                ? <ChevronUp className="w-3 h-3 text-[#1e40af] stroke-[2.5]" /> 
                : <ChevronDown className="w-3 h-3 text-[#1e40af] stroke-[2.5]" />
            )}
          </button>
          
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown(colKey);
              }}
              className={`p-1 rounded hover:bg-slate-200 transition-colors outline-none focus:ring-1 focus:ring-blue-400 ${
                isFiltered 
                  ? 'text-blue-700 bg-blue-100 border border-blue-200 shadow-3xs hover:bg-blue-150' 
                  : 'text-slate-400 opacity-60 group-hover/head:opacity-100'
              }`}
              title="Filtros avanzados (estilo Excel)"
            >
              <Filter className="w-3 h-3 stroke-[2]" />
            </button>
            
            {activeDropdown === colKey && (
              <div 
                className="absolute top-full mt-1.5 w-60 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 text-left p-3.5 text-xs normal-case font-sans font-normal text-slate-800 animate-in fade-in slide-in-from-top-1.5 duration-150"
                onClick={(e) => e.stopPropagation()}
                style={{
                  right: alignment === 'right' || colKey === 'oc' || colKey === 'level' ? 0 : 'auto',
                  left: alignment === 'right' || colKey === 'oc' || colKey === 'level' ? 'auto' : -4,
                }}
              >
                {/* Excel style header */}
                <div className="pb-2 border-b border-slate-150 flex items-center justify-between font-bold text-slate-900 text-[11px] tracking-wide">
                  <span className="uppercase text-slate-500 text-[10px]">Filtrar {label}</span>
                  <button 
                    type="button" 
                    onClick={() => setActiveDropdown(null)} 
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                {/* Sort Actions */}
                <div className="py-2 space-y-1 border-b border-slate-150">
                  <button
                    type="button"
                    onClick={() => {
                      setSortColumn(colKey);
                      setSortDirection('asc');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left py-1 px-2 hover:bg-slate-100 rounded flex items-center gap-2 text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-slate-450" />
                    <span>A-Z / Menor a Mayor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortColumn(colKey);
                      setSortDirection('desc');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left py-1 px-2 hover:bg-slate-100 rounded flex items-center gap-2 text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-slate-450" />
                    <span>Z-A / Mayor a Menor</span>
                  </button>
                </div>
                
                {/* Unique Checkboxes search list */}
                <div className="mt-2.5">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar en valores..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none focus:ring-1 focus:ring-blue-500 font-sans focus:bg-white"
                    />
                  </div>
                  
                  {/* Option values with custom scroll */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-lg p-2 bg-slate-50">
                    <label className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-slate-900 select-none">
                      <input
                        type="checkbox"
                        checked={isAllSelectedForCol(colKey)}
                        onChange={(e) => handleToggleSelectAllCol(colKey, e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-bold text-slate-700 text-[11px]">(Seleccionar Todo)</span>
                    </label>
                    
                    {getUniqueColValuesFiltered(colKey).map((valOption) => {
                      const isChecked = isColValChecked(colKey, valOption);
                      return (
                        <label key={valOption} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleValChecked(colKey, valOption)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span 
                            className={`truncate text-[11px] ${valOption === 'null y campos faltantes' ? 'text-slate-400 italic bg-slate-100/30 px-1 rounded border border-dashed border-slate-200' : 'text-slate-650'}`} 
                            title={valOption === 'null y campos faltantes' ? 'null o vacíos' : valOption}
                          >
                            {valOption === 'null y campos faltantes' ? '[null / vacíos]' : valOption}
                          </span>
                        </label>
                      );
                    })}
                    {getUniqueColValuesFiltered(colKey).length === 0 && (
                      <p className="text-[10px] text-slate-400 text-center py-2">Sin coincidencias</p>
                    )}
                  </div>
                </div>

                {/* Foot actions */}
                <div className="mt-3 flex gap-2 justify-between pt-2 border-t border-slate-150 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      clearColumnFilter(colKey);
                      setActiveDropdown(null);
                    }}
                    className="px-2 py-1 text-red-650 hover:bg-red-50 rounded transition-colors font-medium animate-pulse"
                  >
                    Borrar Filtro
                  </button>
                  <button
                    type="button"
                    key={`apply-col-filter-${colKey}`}
                    onClick={() => setActiveDropdown(null)}
                    className="px-3 py-1 bg-[#1e40af] hover:bg-blue-800 text-white font-bold rounded-md transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  // ==========================================
  // KANBAN VIEW LOGIC & RENDER SYSTEM (V2.5)
  // ==========================================
  const COLUMNS: (string)[] = [
    'Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'
  ];

  const getDaysInStage = (dateEntered: string) => {
    if (!dateEntered) return 0;
    const dStart = new Date(dateEntered);
    const dToday = new Date('2026-06-14T09:43:10'); // Mexican City time as per metadata
    const diffTime = dToday.getTime() - dStart.getTime();
    if (diffTime <= 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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

  const formatMexicoCityDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parts[2]} ${months[mIdx]}`;
      }
    } catch (e) {}
    return dateStr;
  };

  // Drag operations
  const handleCardDragStart = (e: React.DragEvent, recordId: string) => {
    if (role === 'Solo Lectura') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', recordId);
    setDraggingCardId(recordId);
  };

  const handleCardDragEnd = () => {
    setDraggingCardId(null);
    setDragOverStage(null);
  };

  const [draggedOverCardId, setDraggedOverCardId] = useState<string | null>(null);

  // Helper to get ALL records currently assigned to a stage
  const getStageRecords = (stage: string): CRMRecord[] => {
    return records.filter(r => {
      const meta = kanbanMeta[r.id];
      return meta && meta.stage === stage;
    }).sort((a,b) => {
      const pA = a.prioridad !== undefined && a.prioridad !== null ? Number(a.prioridad) : 0;
      const pB = b.prioridad !== undefined && b.prioridad !== null ? Number(b.prioridad) : 0;
      if (pA !== pB) return pB - pA;
      const dateA = a.fecha_registro || '';
      const dateB = b.fecha_registro || '';
      return dateB.localeCompare(dateA) || a.id.localeCompare(b.id);
    });
  };

  const saveNewListPrioritiesAndStage = (
    newList: CRMRecord[], 
    targetStage: string, 
    draggedId: string, 
    sourceStage: string
  ) => {
    const updatedMeta = { ...kanbanMeta };

    // Update the dragged card stage in meta
    if (updatedMeta[draggedId]) {
      updatedMeta[draggedId] = {
        ...updatedMeta[draggedId],
        stage: targetStage,
        dateEnteredStage: sourceStage !== targetStage ? getMexicoCityDateString() : updatedMeta[draggedId].dateEnteredStage
      };
      setKanbanMeta(updatedMeta);
    }

    // Determine target project status/estado
    const defaultTarget = getDefaultStageForCustom(targetStage);
    let newEstadoProyecto: any = undefined;
    let newStatusProyecto: any = undefined;
    if (defaultTarget === 'Negociación') {
      newEstadoProyecto = 'Negociación';
      newStatusProyecto = 'Warm';
    } else if (defaultTarget === 'Cotizado') {
      newEstadoProyecto = 'Propuesta';
      newStatusProyecto = 'Cool';
    } else if (defaultTarget === 'Nuevo' || defaultTarget === 'Contactado') {
      newEstadoProyecto = 'Propuesta';
      newStatusProyecto = 'Cool';
    }

    // Now assign new priorities. The top card has priority newList.length * 10, the next (newList.length - 1) * 10, etc.
    newList.forEach((rec, idx) => {
      const newPriority = (newList.length - idx) * 10;
      const isDragged = rec.id === draggedId;

      const updatedRecord: CRMRecord = {
        ...rec,
        etapa: targetStage,
        prioridad: newPriority,
        nivel_termo: isDragged && newStatusProyecto !== undefined ? newStatusProyecto : (rec.nivel_termo || rec.status_proyecto || 'Cool'),
        estado: isDragged && newEstadoProyecto !== undefined ? newEstadoProyecto : (rec.estado || rec.estado_proyecto || 'Propuesta'),
        // Also update standard ones to keep fully compatible
        status_proyecto: isDragged && newStatusProyecto !== undefined ? newStatusProyecto : rec.status_proyecto,
        estado_proyecto: isDragged && newEstadoProyecto !== undefined ? newEstadoProyecto : rec.estado_proyecto
      };

      onUpdateRecord(updatedRecord);
    });

    if (sourceStage !== targetStage) {
      const r = records.find(item => item.id === draggedId);
      onShowAudit('MODIFICACIÓN', `Licitación comercial ${r?.informacion_general_folio || ''} reordenada y movida a etapa [${targetStage}] con prioridad reajustada.`);
    } else {
      const r = records.find(item => item.id === draggedId);
      onShowAudit('MODIFICACIÓN', `Licitación comercial ${r?.informacion_general_folio || ''} reordenada verticalmente en la etapa [${targetStage}].`);
    }
  };

  const handleCardDragOverCard = (e: React.DragEvent, targetCardId: string, cardStage: string) => {
    if (role === 'Solo Lectura') return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedOverCardId !== targetCardId) {
      setDraggedOverCardId(targetCardId);
    }
    if (dragOverStage !== cardStage) {
      setDragOverStage(cardStage);
    }
  };

  const handleCardDropOnCard = (e: React.DragEvent, targetCardId: string, targetStage: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverCardId(null);
    setDragOverStage(null);
    setDraggingCardId(null);
    
    if (role === 'Solo Lectura') return;

    const recordId = e.dataTransfer.getData('text/plain') || draggingCardId;
    if (!recordId || recordId === targetCardId) return;

    // Get current cards in the target stage
    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (!sourceCard) return;

    const currentMeta = kanbanMeta[recordId];
    const sourceStage = currentMeta?.stage || 'Nuevo';

    // Check if moving to closed state
    const defaultTarget = getDefaultStageForCustom(targetStage);
    if (sourceStage !== targetStage && (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido')) {
      // Trigger confirmation modal
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
      return;
    }

    // Reorder locally
    let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
    const targetIdx = listWithoutDragged.findIndex(r => r.id === targetCardId);
    
    if (targetIdx !== -1) {
      // Insert BEFORE targetCardId
      listWithoutDragged.splice(targetIdx, 0, sourceCard);
    } else {
      listWithoutDragged.push(sourceCard);
    }

    saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
  };

  const handleCardDropOnColumn = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    setDraggingCardId(null);
    setDraggedOverCardId(null);

    if (role === 'Solo Lectura') return;

    const recordId = e.dataTransfer.getData('text/plain') || draggingCardId;
    if (!recordId) return;

    const currentMeta = kanbanMeta[recordId];
    const sourceStage = currentMeta?.stage || 'Nuevo';

    // If dropping on column background, we append it to the end of target stage
    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (!sourceCard) return;

    // Check if moving to closed state
    const defaultTarget = getDefaultStageForCustom(targetStage);
    if (sourceStage !== targetStage && (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido')) {
      // Trigger confirmation modal
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
      return;
    }

    // Filter out dragged card from target stage to avoid duplicate
    let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
    
    // Append to end of the list
    listWithoutDragged.push(sourceCard);

    saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
  };

  const handleCardStageChange = (
    recordId: string, 
    targetStage: string
  ) => {
    const currentMeta = kanbanMeta[recordId];
    if (!currentMeta) return;
    const sourceStage = currentMeta.stage;
    if (sourceStage === targetStage) return;

    const defaultTarget = getDefaultStageForCustom(targetStage);

    if (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido') {
      // Trigger confirmation modal
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
    } else {
      // Reorder and append
      const stageRecords = getStageRecords(targetStage);
      const sourceCard = records.find(r => r.id === recordId);
      if (sourceCard) {
        let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
        listWithoutDragged.push(sourceCard);
        saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
      }
    }
  };

  const handleBulkStageChange = (
    recordIds: string[],
    targetStage: string
  ) => {
    if (recordIds.length === 0) return;

    const updatedMeta = { ...kanbanMeta };
    const defaultTarget = getDefaultStageForCustom(targetStage);

    recordIds.forEach(id => {
      const currentMeta = kanbanMeta[id];
      if (!currentMeta) return;
      const sourceStage = currentMeta.stage;
      if (sourceStage === targetStage) return;

      updatedMeta[id] = {
        ...currentMeta,
        stage: targetStage,
        dateEnteredStage: '2026-06-14'
      };

      const r = records.find(rec => rec.id === id);
      if (r) {
        let newEstadoProyecto = r.estado_proyecto;
        let newStatusProyecto = r.status_proyecto;

        if (defaultTarget === 'Negociación') {
          newEstadoProyecto = 'Negociación';
          newStatusProyecto = 'Warm';
        } else if (defaultTarget === 'Cotizado') {
          newEstadoProyecto = 'Propuesta';
          newStatusProyecto = 'Cool';
        } else if (defaultTarget === 'Nuevo' || defaultTarget === 'Contactado') {
          newEstadoProyecto = 'Propuesta';
          newStatusProyecto = 'Cool';
        }

        onUpdateRecord({
          ...r,
          estado_proyecto: newEstadoProyecto,
          status_proyecto: newStatusProyecto,
          etapa: targetStage,
          nivel_termo: newStatusProyecto,
          estado: newEstadoProyecto
        });
      }
    });

    setKanbanMeta(updatedMeta);
    onShowAudit('MODIFICACIÓN', `${recordIds.length} proyectos asignados en lote a la etapa [${targetStage}].`);
  };

  const handleConfirmCloseDrag = () => {
    if (!pendingDrag) return;
    const { recordId, targetStage, sourceStage } = pendingDrag;
    
    // Reorder and append
    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (sourceCard) {
      const defaultTarget = getDefaultStageForCustom(targetStage);
      
      // Update local card with closing information
      const updatedCard: CRMRecord = {
        ...sourceCard,
        estado_proyecto: defaultTarget === 'Cerrado Ganado' ? 'Cerrado Ganado' : null,
        status_proyecto: defaultTarget === 'Cerrado Ganado' ? 'Win' : 'Cool',
        notas_comerciales: closeNotes ? `${sourceCard.notas_comerciales || ''}\n[Cierre ${targetStage} - Motivo: ${closeReason}]: ${closeNotes}` : sourceCard.notas_comerciales,
        etapa: targetStage,
        nivel_termo: defaultTarget === 'Cerrado Ganado' ? 'Win' : 'Cool',
        estado: defaultTarget === 'Cerrado Ganado' ? 'Cerrado Ganado' : 'Propuesta'
      };

      // Ensure the metadata gets updated with reason/notes
      const updatedMeta = { ...kanbanMeta };
      if (updatedMeta[recordId]) {
        updatedMeta[recordId] = {
          ...updatedMeta[recordId],
          motivoCierre: closeReason,
          notasCierre: closeNotes
        };
        setKanbanMeta(updatedMeta);
      }

      let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
      listWithoutDragged.push(updatedCard);
      saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
    }

    setPendingDrag(null);
  };

  // Add card straight from Column Header
  const handleAddNewCardInStage = (stage: string) => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueado el alta de registros.`);
      return;
    }
    setAssignTargetStage(stage);
    setAssignModalSearch('');
    setAssignModalTempFilter('All');
    setSelectedAssignIds([]);
    setAssignModalOpen(true);
  };

  // Drawer action list helpers
  const handleToggleSubtask = (recordId: string, subtaskId: string) => {
    const updatedMeta = { ...kanbanMeta };
    const meta = updatedMeta[recordId];
    if (!meta) return;

    meta.subtasks = meta.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    setKanbanMeta(updatedMeta);
  };

  const handleAddSubtask = (recordId: string, text: string) => {
    if (!text.trim()) return;
    const updatedMeta = { ...kanbanMeta };
    const meta = updatedMeta[recordId];
    if (!meta) return;

    const newS = {
      id: `s-custom-${Date.now()}`,
      text: text.trim(),
      completed: false
    };
    meta.subtasks = [...meta.subtasks, newS];
    setKanbanMeta(updatedMeta);
  };

  // Generate filtered records per stage (Memoized Kanban Columns Engine)
  const columnsWithCards = useMemo(() => {
    return kanbanColumns.map(stage => {
      // Find cards mapped to this column
      let cards = records.filter(r => {
        const meta = kanbanMeta[r.id];
        if (!meta) return false;
        
        // Match stage column
        if (meta.stage !== stage) return false;

        // Apply general text query filters (Search bar)
        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchesSearch = 
            (r.informacion_general_folio || '').toLowerCase().includes(q) ||
            (r.informacion_general_cliente || '').toLowerCase().includes(q) ||
            (r.informacion_general_proyecto || '').toLowerCase().includes(q) ||
            (r.informacion_general_planta || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }

        // Filter by Owner / Responsable
        if (kanbanFilterResponsable !== 'All') {
          if (meta.responsable !== kanbanFilterResponsable) return false;
        }

        // Filter by Temperature / Level (HOT/COOL/WIN/WARM)
        if (kanbanFilterTemperature !== 'All') {
          if (r.status_proyecto !== kanbanFilterTemperature) return false;
        }

        // Filter by Client name
        if (kanbanFilterClient !== 'All') {
          if (r.informacion_general_cliente !== kanbanFilterClient) return false;
        }

        // Filter "Mi Kanban"
        if (kanbanMiKanbanOnly) {
          const isUserSaved = localStorage.getItem('verse_google_user');
          const currentUserName = isUserSaved ? JSON.parse(isUserSaved)?.name || 'Geovanni Andrade' : 'Geovanni Andrade';
          if (meta.responsable !== currentUserName) return false;
        }

        return true;
      });

      // Apply Column specific Sorting
      const sortType = columnSorting[stage];
      if (sortType === 'monto') {
        cards = [...cards].sort((a,b) => (b.total_subtotal_cotizacion || 0) - (a.total_subtotal_cotizacion || 0));
      } else if (sortType === 'antiguedad') {
        cards = [...cards].sort((a,b) => {
          const daysA = getDaysInStage(kanbanMeta[a.id]?.dateEnteredStage);
          const daysB = getDaysInStage(kanbanMeta[b.id]?.dateEnteredStage);
          return daysB - daysA; // Oldest first
        });
      } else if (sortType === 'responsable') {
        cards = [...cards].sort((a,b) => {
          const nameA = kanbanMeta[a.id]?.responsable || '';
          const nameB = kanbanMeta[b.id]?.responsable || '';
          return nameA.localeCompare(nameB);
        });
      } else {
        // DEFAULT ORDER: Sort by prioridad DESC, then newest registration date, then stable fallback ID
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

      const totalDays = cards.reduce((acc, r) => acc + getDaysInStage(kanbanMeta[r.id]?.dateEnteredStage), 0);
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
  }, [kanbanColumns, records, kanbanMeta, searchTerm, kanbanFilterResponsable, kanbanFilterTemperature, kanbanFilterClient, kanbanMiKanbanOnly, columnSorting, wipLimits]);

  const renderKanbanView = () => {

    const uniqueClientsList = Array.from(new Set(records.map(r => r.informacion_general_cliente).filter(Boolean))) as string[];

    return (
      <div className="space-y-4 fade-in">
        {/* KANBAN FILTER CONTROLS BAR */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex flex-wrap items-center justify-between gap-3 text-left">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Owner */}
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

            {/* Filter by Temperature */}
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

            {/* Filter by Client */}
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

            {/* Clear Filters Button */}
            {(kanbanFilterResponsable !== 'All' || kanbanFilterTemperature !== 'All' || kanbanFilterClient !== 'All' || localSearchTerm !== '') && (
              <button
                onClick={() => {
                  setKanbanFilterResponsable('All');
                  setKanbanFilterTemperature('All');
                  setKanbanFilterClient('All');
                  setLocalSearchTerm('');
                  setSearchTerm('');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 self-end mt-4 h-8 transition-all"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpiar Filtros
              </button>
            )}
          </div>

          {/* Toggle Mi Kanban */}
          <div className="flex items-center gap-2 self-end">
            <button
              onClick={() => setKanbanMiKanbanOnly(!kanbanMiKanbanOnly)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                kanbanMiKanbanOnly 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white text-slate-600 border-slate-250 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              👤 Mi Kanban
            </button>
          </div>
        </div>

        {/* HORIZONTAL SCROLL COLUMNS VIEW */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-350 select-none">
          {columnsWithCards.map(({ stage, cards, totalMonto, limit, isOverWip, avgDays }) => {
            
            // Render specific Stage Headers
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
                {/* COLUMN HEADER */}
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
                    <div className="text-[11px] text-slate-400">
                      {formatCurrencyShort(totalMonto)} USD · prom. {avgDays}d
                    </div>
                  </div>

                  {/* COLUMN CONTROLS */}
                  <div className="flex items-center gap-0.5 relative">
                    {/* Add Button */}
                    <button
                      onClick={() => handleAddNewCardInStage(stage)}
                      disabled={role === 'Solo Lectura'}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                      title="Agregar nueva tarjeta a esta etapa"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    
                    {/* sorting override menu button with dropdown list */}
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
                        <div className="absolute right-0 top-7 w-[210px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                          {/* Heading: Ordenar por */}
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
                            className="w-full px-3 py-1.5 text-xs text-slate-705 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                          >
                            <span>Por Defecto (Sin orden)</span>
                            {columnSorting[stage] === null && <Check className="w-3 h-3 text-blue-600" />}
                          </button>

                          <div className="h-px bg-slate-100 my-1"></div>

                          {/* Heading: Configurar */}
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

                          {/* Heading: Column Actions */}
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

                {/* WIP LIMIT OVER-ALERT */}
                {isOverWip && (
                  <div className="mt-2 bg-red-100 border border-red-200 px-2.5 py-1 rounded text-[9px] text-red-700 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                    <span>Límite WIP excedido ({cards.length} &gt; {limit})</span>
                  </div>
                )}

                         <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5 select-text">
                  {cards.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-3 text-center text-slate-400">
                      <span className="text-[10px] font-medium font-mono uppercase tracking-wider">Vacío / Sin leads</span>
                      <p className="text-[9px] mt-1 shrink-0">Arrastra una ficha aquí para mover.</p>
                    </div>
                  ) : (
                    cards.map((card) => {
                      const meta = kanbanMeta[card.id] || {
                        stage: card.etapa || 'Nuevo',
                        dateEnteredStage: card.fecha_cambio_etapa || card.fecha_registro || getMexicoCityDateString(),
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
  };

  const renderDrawerLateralPanel = () => {
    if (!activeDrawerRecordId) return null;
    const cardId = activeDrawerRecordId;
    
    // Use draftRecord and draftMeta instead of the parent ones!
    if (!draftRecord || !draftMeta) return null;

    const subtasks = Array.isArray(draftMeta?.subtasks) ? draftMeta.subtasks : [];
    const completed = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0 ? (completed / subtasks.length) * 100 : 0;

    // Standard B2B followup contact method options
    const contactMethods = [
      'Llamada Telefónica',
      'Correo Electrónico',
      'Reunión Presencial',
      'Reunión Virtual',
      'WhatsApp',
      'Mensaje de Texto'
    ];

    // Reverse followups list to show newest to oldest with safe fallback
    const reversedFollowups = Array.isArray(draftRecord?.acciones_seguimiento) 
      ? [...draftRecord.acciones_seguimiento].reverse() 
      : [];

    // Stagnation threshold limit
    const stagLimit = draftMeta.stagnation_days_limit || 5;

    // Handle saving all accumulated changes at once!
    const handleSaveConsolidatedChanges = () => {
      // 1. Update parent kanbanMeta state
      const updatedMeta = {
        ...kanbanMeta,
        [draftRecord.id]: {
          ...draftMeta,
          checklist_tasks: JSON.stringify(subtasks),
          responsable: draftMeta.responsable,
          tags: draftMeta.tags.join(','),
          fecha_cambio_etapa: draftMeta.dateEnteredStage,
          stagnation_days_limit: draftMeta.stagnation_days_limit
        }
      };
      setKanbanMeta(updatedMeta);
      localStorage.setItem('verse_crm_kanban_meta', JSON.stringify(updatedMeta));

      // 2. Map metadata fields directly on draftRecord before saving to DB
      const selectedUser = dbUsers.find(u => u.nombre === draftMeta.responsable);
      const assignedId = selectedUser ? selectedUser.id : null;

      const packedRecord: CRMRecord = {
        ...draftRecord,
        etapa: draftMeta.stage,
        fecha_cambio_etapa: draftMeta.dateEnteredStage,
        stagnation_days_limit: draftMeta.stagnation_days_limit,
        checklist_tasks: JSON.stringify(subtasks),
        __tareas: subtasks,
        responsable: draftMeta.responsable,
        contacto_asignado_id: assignedId,
        tags: draftMeta.tags.join(',')
      };

      onUpdateRecord(packedRecord);
      onShowAudit('MODIFICACIÓN', `Cambios consolidados y guardados para la licitación ${draftRecord.informacion_general_folio}.`);
      setActiveDrawerRecordId(null);
    };

    // Handle progress advance logs addition (Guardar Avance)
    const handleAddAdvanceLog = () => {
      if (!newFollowupNotes || !newFollowupNotes.trim()) {
        alert("Escriba notas para guardar el avance de seguimiento.");
        return;
      }
      const newEntry: FollowupEntry = {
        id: `f_add_${Math.random().toString(36).substring(2, 9)}`,
        fecha: getMexicoCityDateString(),
        tipo: newFollowupMethod,
        creador: activeSessionUserName || 'Geovanni Andrade',
        notas: newFollowupNotes.trim()
      };
      setDraftRecord({
        ...draftRecord,
        acciones_seguimiento: [...(draftRecord.acciones_seguimiento || []), newEntry]
      });
      setNewFollowupNotes('');
      // User requested to register current date on action
      onShowAudit('CONEXIÓN HOJA', `Se agregó nota de seguimiento interactiva para el folio ${draftRecord.informacion_general_folio}.`);
    };

    return createPortal(
      <div className="fixed inset-0 z-50 overflow-hidden text-slate-800">
        {/* SEMITRANSPARENT OVERLAY CLOSING */}
        <div 
          className="absolute inset-0 bg-[#071322]/45 backdrop-blur-xs transition-opacity animate-fade-in"
          onClick={() => {
            setActiveDrawerRecordId(null);
          }}
        />

        <div className="absolute inset-y-0 right-0 max-w-4xl w-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-slide-in select-text">
          {/* DRAWER HEADER */}
          <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">Consola de Licitación comercial B2B</span>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Licitación {draftRecord.informacion_general_folio || 'S/F'}
              </h3>
            </div>
            
            <button 
              onClick={() => {
                setActiveDrawerRecordId(null);
              }}
              className="p-1 px-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* DRAWER SCROLL CONTENT CONTAINER */}
          <div className="flex-1 overflow-y-auto p-6 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* COLUMNA IZQUIERDA (65%) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1. Cliente & Proyecto title editable summary */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-450 tracking-wider font-mono">Información de Identidad</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 font-mono mb-1">Nombre del Proyecto</label>
                      <input
                        type="text"
                        value={draftRecord.informacion_general_proyecto || ''}
                        onChange={(e) => {
                          setDraftRecord({ ...draftRecord, informacion_general_proyecto: e.target.value });
                        }}
                        disabled={role === 'Solo Lectura'}
                        className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        placeholder="e.g. Medición de Flujo"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-500 font-mono mb-1">Cliente Legal</label>
                      <input
                        type="text"
                        value={draftRecord.informacion_general_cliente || ''}
                        onChange={(e) => {
                          setDraftRecord({ ...draftRecord, informacion_general_cliente: e.target.value });
                        }}
                        disabled={role === 'Solo Lectura'}
                        className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        placeholder="e.g. Grupo Bimbo"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Checklist */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider font-mono">Tareas de la Etapa Actual</h4>
                    <span className="text-[10px] bg-slate-100 font-bold px-2.5 py-0.5 rounded-full border border-slate-250 text-slate-600">
                      {completed}/{subtasks.length} completadas
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Checklist list */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pt-1 pr-1">
                    {subtasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No hay tareas creadas para esta etapa.</p>
                    ) : (
                      subtasks.map(sub => (
                        <div 
                          key={sub.id} 
                          className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-slate-200 gap-2"
                        >
                          <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sub.completed}
                              onChange={() => {
                                setDraftMeta({
                                  ...draftMeta,
                                  subtasks: subtasks.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s)
                                });
                              }}
                              disabled={role === 'Solo Lectura'}
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className={`text-xs ${sub.completed ? 'line-through text-slate-400 font-medium' : 'text-slate-700 font-bold'}`}>
                              {sub.text}
                            </span>
                          </label>
                          {role !== 'Solo Lectura' && (
                            <button
                              onClick={() => {
                                setDraftMeta({
                                  ...draftMeta,
                                  subtasks: subtasks.filter(s => s.id !== sub.id)
                                });
                              }}
                              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add checklist item */}
                  {role !== 'Solo Lectura' && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const input = form.elements.namedItem('subtaskText') as HTMLInputElement;
                        const text = input.value.trim();
                        if (text) {
                          setDraftMeta({
                            ...draftMeta,
                            subtasks: [
                              ...subtasks,
                              {
                                id: `sub_${Math.random().toString(36).substring(2, 9)}`,
                                text,
                                completed: false
                              }
                            ]
                          });
                          form.reset();
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        name="subtaskText"
                        placeholder="Agregar un nuevo requerimiento..."
                        className="flex-1 bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button 
                        type="submit"
                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                      >
                        Agregar
                      </button>
                    </form>
                  )}
                </div>

                {/* 3. Progress / Notes Log input */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider font-mono">Nuevo Log / Reporte de Avance</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">Método de Contacto</label>
                      <select
                        value={newFollowupMethod}
                        onChange={(e) => setNewFollowupMethod(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {contactMethods.map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">Notas del Seguimiento</label>
                    <textarea
                      value={newFollowupNotes}
                      onChange={(e) => setNewFollowupNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Describa el avance comercial obtenido con el cliente..."
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddAdvanceLog}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-3xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Guardar Avance</span>
                    </button>
                  </div>
                </div>

                {/* 4. Timeline Type history logs */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider font-mono">Historial de Seguimiento B2B (Recientes Primero)</h4>
                  
                  {reversedFollowups.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay logs registrados en el historial.</p>
                  ) : (
                    <div className="relative pl-4 border-l border-slate-200 space-y-4">
                      {reversedFollowups.map((f, fIdx) => (
                        <div key={f.id || fIdx} className="relative text-left group">
                          <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                          
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] text-slate-400 font-bold font-mono">
                              {f.fecha}
                            </div>
                            
                            {/* Edit & Delete Controls */}
                            {role !== 'Solo Lectura' && editingFollowupId !== f.id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingFollowupId(f.id);
                                    setEditingFollowupNotes(f.notas);
                                  }}
                                  className="p-1 text-slate-450 hover:text-blue-600 rounded transition cursor-pointer"
                                  title="Editar nota"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    const updated = (draftRecord.acciones_seguimiento || []).filter(item => item.id !== f.id);
                                    setDraftRecord({ ...draftRecord, acciones_seguimiento: updated });
                                  }}
                                  className="p-1 text-slate-450 hover:text-red-600 rounded transition cursor-pointer"
                                  title="Eliminar nota"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] font-black text-slate-700">
                            {f.tipo} - <span className="text-[9px] text-slate-450 uppercase">{f.creador}</span>
                          </div>

                          {editingFollowupId === f.id ? (
                            <div className="mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-2">
                              <textarea
                                value={editingFollowupNotes}
                                onChange={(e) => setEditingFollowupNotes(e.target.value)}
                                className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-md text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                rows={2}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingFollowupId(null);
                                  }}
                                  className="px-2 py-1 text-[10px] border border-slate-200 text-slate-600 rounded font-bold hover:bg-slate-100 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => {
                                    if (!editingFollowupNotes.trim()) return;
                                    const updated = (draftRecord.acciones_seguimiento || []).map(item => {
                                      if (item.id === f.id) {
                                        return { ...item, notas: editingFollowupNotes.trim() };
                                      }
                                      return item;
                                    });
                                    setDraftRecord({ ...draftRecord, acciones_seguimiento: updated });
                                    setEditingFollowupId(null);
                                  }}
                                  className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded font-bold hover:bg-blue-700 cursor-pointer"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                              {f.notas}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* COLUMNA DERECHA (35%) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* 1. MÓDULO FINANCIERO CON VALORES DE SUBTOTAL, HW, SERVICIOS, IVA Y TOTAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-450 tracking-wider font-mono">Valores de Cotización</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 font-mono mb-1">Coste Suministros (HW)</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          value={draftRecord.total_hardware_cotizacion !== null && draftRecord.total_hardware_cotizacion !== undefined ? draftRecord.total_hardware_cotizacion : ''}
                          onChange={(e) => {
                            const hw = e.target.value === '' ? null : Number(e.target.value);
                            const serv = draftRecord.total_servicios_cotizacion;
                            const sub = (hw === null && serv === null) ? null : ((hw !== null ? hw : 0) + (serv !== null ? serv : 0));
                            const iva = 0;
                            const tot = sub;
                            setDraftRecord({
                              ...draftRecord,
                              total_hardware_cotizacion: hw,
                              total_subtotal_cotizacion: sub,
                              total_iva_cotizacion: iva,
                              total_general_cotizacion: tot
                            });
                          }}
                          disabled={role === 'Solo Lectura'}
                          className="w-full bg-white border border-slate-200 py-1.5 pl-7 pr-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 font-mono mb-1">Coste Integ (Servicios)</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          value={draftRecord.total_servicios_cotizacion !== null && draftRecord.total_servicios_cotizacion !== undefined ? draftRecord.total_servicios_cotizacion : ''}
                          onChange={(e) => {
                            const serv = e.target.value === '' ? null : Number(e.target.value);
                            const hw = draftRecord.total_hardware_cotizacion;
                            const sub = (hw === null && serv === null) ? null : ((hw !== null ? hw : 0) + (serv !== null ? serv : 0));
                            const iva = 0;
                            const tot = sub;
                            setDraftRecord({
                              ...draftRecord,
                              total_servicios_cotizacion: serv,
                              total_subtotal_cotizacion: sub,
                              total_iva_cotizacion: iva,
                              total_general_cotizacion: tot
                            });
                          }}
                          disabled={role === 'Solo Lectura'}
                          className="w-full bg-white border border-slate-200 py-1.5 pl-7 pr-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 my-2"></div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-medium">Subtotal Cotización:</span>
                      <span className="font-bold text-slate-800">
                        ${(draftRecord.total_subtotal_cotizacion || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {draftRecord.informacion_general_moneda}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">IVA Trasladado (16%):</span>
                      <span className="font-semibold text-slate-700">
                        ${(draftRecord.total_iva_cotizacion || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {draftRecord.informacion_general_moneda}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-[13px] text-blue-800">
                      <span>Total General (SAT):</span>
                      <span className="font-mono">
                        ${(draftRecord.total_general_cotizacion || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {draftRecord.informacion_general_moneda}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. LOCALIZACIÓN & PLANTA INDUSTRIAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-450 tracking-wider font-mono">Ubicación de Operación</h4>
                  
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-455 font-mono mb-1">Planta Industrial</label>
                    <input
                      type="text"
                      value={draftRecord.informacion_general_planta || ''}
                      onChange={(e) => {
                        setDraftRecord({ ...draftRecord, informacion_general_planta: e.target.value });
                      }}
                      disabled={role === 'Solo Lectura'}
                      className="w-full bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Planta Industrial..."
                    />
                  </div>
                </div>

                {/* 3. PARÁMETROS DE PROCESO & CONTROL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-455 tracking-wider font-mono">Parámetros de Proceso</h4>

                  {/* Stage Selector */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 font-mono">Etapa actual en Pipeline</label>
                    <select
                      value={draftMeta.stage}
                      onChange={(e) => {
                        const nextStage = e.target.value;
                        setDraftMeta({
                          ...draftMeta,
                          stage: nextStage,
                          dateEnteredStage: getMexicoCityDateString() // register stage change date as of today
                        });
                      }}
                      disabled={role === 'Solo Lectura'}
                      className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {kanbanColumns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Member Assigned Selector */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-455 font-mono">Responsable Asignado</label>
                    <select
                      value={draftMeta.responsable || ''}
                      onChange={(e) => {
                        setDraftMeta({
                          ...draftMeta,
                          responsable: e.target.value || ''
                        });
                      }}
                      disabled={role === 'Solo Lectura'}
                      className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Sin Asignar</option>
                      {dbUsers.filter(u => u.estado === 'active').map(u => (
                        <option key={u.id} value={u.nombre}>{u.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stagnation Days Limit customizable threshold */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-455 font-mono">Alerta de Estancamiento (Días)</label>
                    <input
                      type="number"
                      min="1"
                      value={stagLimit}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 5 : Math.max(1, Number(e.target.value));
                        setDraftMeta({
                          ...draftMeta,
                          stagnation_days_limit: val
                        });
                      }}
                      disabled={role === 'Solo Lectura'}
                      className="w-full bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Non-editable temperature status */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-455 font-mono">Nivel de Interés (Termo)</label>
                    <div className="pt-1.5">
                      {renderTemperatureBadge(draftRecord.status_proyecto)}
                    </div>
                  </div>
                </div>

                {/* 4. CONTACT ASSIGNMENT MODULO */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-left">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-455 tracking-wider font-mono">Contacto del Cliente</h4>
                  
                  {/* Select assignment */}
                  <div className="space-y-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-455 font-mono">Asignar Contacto Existente</label>
                    <select
                      value={draftRecord.contacto_nombre || ''}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        if (!selectedName) {
                          setDraftRecord({
                            ...draftRecord,
                            contacto_nombre: null,
                            contacto_puesto: null,
                            contacto_email: null,
                            contacto_telefono: null
                          });
                        } else {
                          const found = contacts.find(c => c.nombre === selectedName);
                          if (found) {
                            setDraftRecord({
                              ...draftRecord,
                              contacto_nombre: found.nombre,
                              contacto_puesto: found.puesto,
                              contacto_email: found.email,
                              contacto_telefono: found.telefono
                            });
                          }
                        }
                      }}
                      disabled={role === 'Solo Lectura'}
                      className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Sin asignación --</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.nombre}>
                          {c.nombre} ({c.cliente} - {c.puesto})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Profile Card Display */}
                  {draftRecord.contacto_nombre ? (
                    <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                          {getInitials(draftRecord.contacto_nombre)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{draftRecord.contacto_nombre}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{draftRecord.contacto_puesto || 'Puesto no registrado'}</div>
                        </div>
                      </div>

                      <div className="h-px bg-slate-100 my-1"></div>

                      <div className="space-y-1 text-[10.5px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{draftRecord.contacto_email || 'Email no registrado'}</span>
                        </div>
                        {draftRecord.contacto_telefono && (
                          <div className="flex items-center gap-1.5 text-[10.5px]">
                            <span className="text-slate-400">📞</span>
                            <span>{draftRecord.contacto_telefono}</span>
                          </div>
                        )}
                      </div>

                      {role !== 'Solo Lectura' && (
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftRecord({
                                ...draftRecord,
                                contacto_nombre: null,
                                contacto_puesto: null,
                                contacto_email: null,
                                contacto_telefono: null
                              });
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Desasignar contacto</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 p-4 rounded-lg text-center text-slate-400 bg-white">
                      <span className="text-[11px] font-medium block">Sin contacto asignado</span>
                      <span className="text-[9px] block mt-0.5">Usa la lista de arriba para asignarle un contacto comercial a este proyecto.</span>
                    </div>
                  )}
                </div>

                {/* 5. GESTIÓN DE CHIPS / TAGS */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-left">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-455 tracking-wider font-mono">Etiquetas y Categorías</h4>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {draftMeta.tags.map((tg, idx) => (
                      <span 
                        key={idx} 
                        className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"
                      >
                        {tg}
                        {role !== 'Solo Lectura' && (
                          <button 
                            onClick={() => {
                              setDraftMeta({
                                ...draftMeta,
                                tags: draftMeta.tags.filter(t => t !== tg)
                              });
                            }}
                            className="text-blue-500 hover:text-red-500 text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    
                    {role !== 'Solo Lectura' && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const input = form.elements.namedItem('tagText') as HTMLInputElement;
                          const val = input.value.trim().toUpperCase();
                          if (val && !draftMeta.tags.includes(val)) {
                            setDraftMeta({
                              ...draftMeta,
                              tags: [...draftMeta.tags, val]
                            });
                          }
                          form.reset();
                        }}
                        className="inline"
                      >
                        <input
                          type="text"
                          name="tagText"
                          placeholder="+ Tag..."
                          className="border border-slate-200 px-2.5 py-0.5 rounded-full text-[9px] outline-none focus:border-blue-500 w-20 text-center font-bold"
                        />
                      </form>
                    )}
                  </div>
                </div>

                {/* 6. OBSERVACIONES / NOTAS COMERCIALES GENERALES */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-left">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-455 tracking-wider font-mono">Observaciones Comerciales</h4>
                  <textarea
                    value={draftRecord.notas_comerciales || ''}
                    onChange={(e) => {
                      setDraftRecord({ ...draftRecord, notas_comerciales: e.target.value });
                    }}
                    disabled={role === 'Solo Lectura'}
                    rows={3}
                    className="w-full bg-white border border-slate-200 py-2 px-3 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Comentarios o notas de bitácora comercial..."
                  />
                </div>

              </div>

            </div>
          </div>

          {/* DRAWER FOOTER WITH ACCUMULATE & SAVE ACTION BUTTONS */}
          <footer className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3.5">
            <button
              onClick={() => {
                setActiveDrawerRecordId(null);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveConsolidatedChanges}
              disabled={role === 'Solo Lectura'}
              className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition shadow-3xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Cambios</span>
            </button>
          </footer>
        </div>
      </div>,
      document.getElementById('root')!
    );
  };

  // ==========================================
  // CONFIRMATION CLOSE DRAG POPUP MODAL (V2.5)
  // ==========================================
  const renderConfirmationCloseModal = () => {
    if (!pendingDrag) return null;
    const { recordId, targetStage, type = 'archive' } = pendingDrag;
    const r = records.find(rec => rec.id === recordId);
    if (!r) return null;

    if (type === 'delete') {
      return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          {/* BLUR BACKGROUND OVERLAY */}
          <div 
            className="absolute inset-0 transition-opacity cursor-pointer"
            onClick={() => setPendingDrag(null)}
          />

          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative z-[101] animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-full text-red-600 border border-red-100 shadow-[inset_0_1px_2px_rgba(239,68,68,0.1)]">
                <Trash2 className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  ¿Confirmar Eliminación?
                </h3>
                <p className="text-xs text-slate-400 font-medium tracking-wide font-sans">OPERACIÓN OPERATIVA IRREVERSIBLE</p>
              </div>
            </div>

            <div className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              Estás a punto de eliminar definitivamente la licitación <strong className="font-bold text-slate-900">{r.informacion_general_proyecto || 'Sin Nombre'}</strong> de {r.informacion_general_cliente || 'Sin Cliente'} con Folio <strong className="font-bold text-red-600 font-data-mono">{r.informacion_general_folio || 'Sin Folio'}</strong>. 
              <span className="block mt-2 font-bold text-slate-800">
                ⚠ Esta acción eliminará permanentemente la información, cotizaciones asociadas y el historial de seguimiento del embudo.
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPendingDrag(null)}
                className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-750 font-bold text-xs rounded-lg transition-all border border-slate-250 active:scale-95 cursor-pointer shadow-3xs"
              >
                No, Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteActual}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 active:scale-95 border-b-2 border-b-red-800 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sí, Eliminar Registro
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    const reasons = targetStage === 'Cerrado Ganado' 
      ? ['Ganado por precio', 'Ganado por relación', 'Ganado por entrega', 'Ganado por tecnología', 'Otro']
      : ['Perdido por presupuesto', 'Perdido por competencia', 'Perdido sin respuesta', 'Perdido por tiempos', 'Otro'];

    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-slate-800 animate-in fade-in duration-150">
        {/* BLUR BACKGROUND OVERLAY */}
        <div 
          className="absolute inset-0 transition-opacity cursor-pointer"
          onClick={() => setPendingDrag(null)}
        />

        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative z-[101] animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
          <header className="pb-3.5 border-b border-slate-150 text-left">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase font-sans tracking-wide">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              Confirmar Cierre de Proyecto ({r.informacion_general_folio})
            </h3>
          </header>

          <div className="py-4 text-left space-y-4">
            <p className="text-xs text-slate-600 font-sans leading-relaxed">
              Está a punto de archivar la licitación <strong>{r.informacion_general_proyecto}</strong> de {r.informacion_general_cliente} en el estado final <strong>({targetStage})</strong>.
            </p>

            {/* Select Reason */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-450 font-mono tracking-wider">Motivo de Cierre</label>
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full bg-slate-150/60 border border-slate-200 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
              >
                {reasons.map(res => (
                  <option key={res} value={res}>{res}</option>
                ))}
              </select>
            </div>

            {/* Optional notes */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-450 font-mono tracking-wider">Notas de Bitácora (Opcional)</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 py-2 px-3 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                placeholder="Indique más detalles sobre los motivos de esta resolución comercial..."
              />
            </div>
          </div>

          <footer className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              onClick={() => setPendingDrag(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 rounded-lg text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmCloseDrag}
              className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition shadow-3xs ${
                targetStage === 'Cerrado Ganado' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Archivar Expediente
            </button>
          </footer>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Upper sub-header bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-150">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            Consola de Leads / Proyectos Activos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mantenimiento técnico operativo de la cartera comercial bajo normativa de IVA (16%) en México.
          </p>
        </div>
        <button
          key="add-btn-lead"
          id="add-record-trigger-btn"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenCreateMode();
          }}
          disabled={role === 'Solo Lectura'}
          className={`flex items-center gap-1.5 px-4 font-bold text-xs py-2 bg-blue-600 text-white rounded-md shadow-3xs hover:bg-blue-700 transition-all relative z-10 ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
        >
          {role === 'Solo Lectura' ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          NUEVA ENTRADA {role === 'Solo Lectura' && '(🔒)'}
        </button>
      </div>

      {/* NEW INTEGRATED LIVE STATS SUMMARY PANEL (DYNAMICAL TO FILTERS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100/70 p-3 rounded-lg border border-slate-200">
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Proyectos Coincidentes
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold text-slate-800">{filteredRecords.length}</span>
            <span className="text-[10px] text-slate-400">de {records.length}</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Monto Neto Acumulado
          </span>
          <div className="text-lg font-bold text-blue-700 font-data-mono mt-0.5">
            ${totalCotizacionesUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] font-sans font-bold">USD</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Pipeline Activo (Cotizado)
          </span>
          <div className="text-lg font-bold text-amber-700 font-data-mono mt-0.5">
            ${totalActivoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] font-sans font-bold">USD</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Monto Promedio Contrato
          </span>
          <div className="text-lg font-bold text-slate-800 font-data-mono mt-0.5">
            ${averageQuotaUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] font-sans font-bold">USD</span>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 mt-2">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            viewMode === 'list'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setViewMode('kanban')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            viewMode === 'kanban'
              ? 'border-blue-600 text-blue-700 font-bold font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="10" width="7" height="11" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          Kanban
          <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1">Estándar</span>
        </button>
        <button
          onClick={() => alert("La vista Calendario es una maqueta no funcional para futuras ampliaciones.")}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 border-transparent text-slate-400 cursor-not-allowed hover:bg-slate-50"
        >
          <Calendar className="w-4 h-4" strokeWidth={2.5} />
          Calendar
        </button>
        <button
          onClick={() => alert("La vista Gantt es una maqueta no funcional para futuras ampliaciones.")}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 border-transparent text-slate-400 cursor-not-allowed hover:bg-slate-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 6h18M3 12h12M3 18h16" />
          </svg>
          Gantt
        </button>
        <button
          onClick={() => alert("La vista Portafolio es una maqueta no funcional para futuras ampliaciones.")}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 border-transparent text-slate-400 cursor-not-allowed hover:bg-slate-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Portfolio
        </button>

        {viewMode === 'kanban' && role !== 'Solo Lectura' && (
          <button
            onClick={() => setColumnConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-auto text-[11px] font-bold transition-all text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md shadow-3xs hover:bg-slate-50 mr-2 my-auto"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar Tablero
          </button>
        )}
      </div>

      {viewMode === 'list' ? (
        <>
          {/* QUICK TABS PILLS FOR PIPELINE STATE */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex bg-slate-200/60 rounded-lg p-1 border border-slate-200">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTabFilter === 'all'
                ? 'bg-white shadow-3xs text-blue-700 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({records.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('active')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTabFilter === 'active'
                ? 'bg-white shadow-3xs text-blue-700 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔥 Activos ({records.filter(r => r.estado_proyecto !== 'Cerrado Ganado').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('closed')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTabFilter === 'closed'
                ? 'bg-white shadow-3xs text-emerald-800 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏆 Cerrados ({records.filter(r => r.estado_proyecto === 'Cerrado Ganado').length})
          </button>
        </div>

        {/* QUICK CLEAN / CLEAR PRESETS */}
        <div className="flex items-center gap-2">
          {/* Selector de número de registros */}
          <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 shadow-3xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wide">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'Todos' ? 'Todos' : Number(val));
                setCurrentPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="Todos">Todos</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setColFilters({});
              setActiveTabFilter('all');
              setYearFilter('All');
              setQuarterFilter('All');
              setRegionFilter('All');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-all"
            title="Limpiar todos los filtros"
          >
            <FilterX className="w-3.5 h-3.5 text-slate-500" />
            Reestablecer Filtros
          </button>

          <button
            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-lg transition-all ${
              isAdvancedFiltersOpen 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros Avanzados
            {isAdvancedFiltersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BOARD (SOLO NO DUPLICADOS Y DINÁMICO) */}
      {isAdvancedFiltersOpen && (
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-3xs animate-in fade-in slide-in-from-top-2 duration-200 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            {/* Year filter */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5 px-1 font-sans flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Año Registro
              </label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
              >
                <option value="All">Todos los Años</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Quarter filter */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5 px-1 font-sans">
                Trimestre (Quarter)
              </label>
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
              >
                <option value="All">Todos (Quarters)</option>
                <option value="Q1">Q1 (Ene-Mar)</option>
                <option value="Q2">Q2 (Abr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dic)</option>
              </select>
            </div>

            {/* Regions requested */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5 px-1 font-sans flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                Región Geográfica
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium cursor-pointer"
              >
                <option value="All">Todas las regiones</option>
                <option value="Centro">México Centro (CDMX/EdoMex)</option>
                <option value="Occidente">México Occidente (Jalisco)</option>
                <option value="Bajío">México Bajío (Silao/Gto)</option>
                <option value="Norte">México Norte (Zac/Mty)</option>
                <option value="EE.UU.">Norteamérica / USA</option>
                <option value="LATAM">Hispanoamérica / LATAM</option>
                <option value="Otro">Otras localizaciones</option>
              </select>
            </div>

            {/* Specific Dates ranges */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1.5 px-1 font-sans">
                Rango de Fechas
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="text-[10px] w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 text-slate-750 font-mono cursor-pointer"
                    title="Fecha Inicial"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="text-[10px] w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 text-slate-755 font-mono cursor-pointer"
                    title="Fecha Final"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main CRM records table inside a 3D bevel elevated paper card */}
      <div className="relative bg-slate-100/40 p-4 rounded-xl border border-slate-200 shadow-[inset_0_2px_4px_rgba(15,23,42,0.05)] mb-6">
        <div className="bg-white border-t border-l border-slate-200 border-r-2 border-b-6 border-b-[#c3cbd5] border-r-[#e2e8f0] rounded-xl shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18),_0_0_0_1px_rgba(15,23,42,0.03),_0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_26px_55px_-10px_rgba(15,23,42,0.22)] hover:translate-y-[-1px]">
          
          {/* CONTROL DE BÚSQUEDA INTERNO DE LA TABLA (INTEGRATED TOOLBAR) */}
          <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                placeholder="Buscar por folio, cliente, planta o descripción..."
                className="text-xs w-full bg-white border border-slate-250 py-2 pl-9 pr-8 rounded-lg hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-3xs font-medium"
              />
              {localSearchTerm && (
                <button
                  type="button"
                  onClick={() => setLocalSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-3xs text-slate-705 font-mono">
                {filteredRecords.length}
              </span>
              <span>de {records.length} registros totales</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[640px] overflow-y-auto scrollbar-thin min-h-[400px]">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-[#f8fafc] border-b-2 border-slate-200 text-xs uppercase text-slate-500 font-label-caps sticky top-0 z-20 shadow-2xs">
                <tr>
                  {renderHeaderCell('folio', 'Folio')}
                  {renderHeaderCell('client', 'Cliente')}
                  {renderHeaderCell('plant', 'Planta Industrial')}
                  {renderHeaderCell('project', 'Descripción Proyecto')}
                  {renderHeaderCell('amount', 'Subtotal Proyecto', 'right')}
                  {renderHeaderCell('stage', 'Etapa', 'center')}
                  {renderHeaderCell('responsable', 'Responsable', 'center')}
                  {renderHeaderCell('status', 'Estado')}
                  {renderHeaderCell('level', 'Nivel / Termo', 'center')}
                  {renderHeaderCell('actions_followup', 'Nueva Acción', 'center')}
                  {renderHeaderCell('actions_history', 'Historial Acciones', 'center')}
                  {renderHeaderCell('checklist_progress', 'Checklist Tareas', 'center')}
                  <th className="p-3 px-4 font-bold text-right text-slate-500 w-[8%] min-w-[100px] max-w-[120px]">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-sm">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400">
                      Ningún registro mapea con los filtros definidos.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr 
                      key={r.id} 
                      className="border-b border-slate-200/80 last:border-b-0 odd:bg-white even:bg-slate-100/50 hover:bg-blue-50/30 transition-colors group"
                    >
                      <td className={`p-3 px-4 font-bold font-data-mono text-[#004ddf] text-xs truncate ${getColWidthClass('folio')}`}>
                        {r.informacion_general_folio || <span className="text-slate-400 font-normal italic">null</span>}
                      </td>
                      <td className={`p-3 px-4 text-[#0b1c30] truncate ${getColWidthClass('client')}`} title={r.informacion_general_cliente || ''}>
                        {r.informacion_general_cliente ? <span className="font-bold">{r.informacion_general_cliente}</span> : <span className="text-slate-400 font-normal italic text-xs">null</span>}
                      </td>
                      <td className={`p-3 px-4 text-slate-500 truncate ${getColWidthClass('plant')}`} title={r.informacion_general_planta || ''}>
                        {r.informacion_general_planta || <span className="text-slate-400 font-normal italic">null</span>}
                      </td>
                      <td className={`p-3 px-4 text-slate-700 font-medium truncate ${getColWidthClass('project')}`} title={r.informacion_general_proyecto || ''}>
                        <div className="font-semibold text-slate-800 leading-tight">
                          {r.informacion_general_proyecto || <span className="text-slate-400 font-normal italic">null</span>}
                        </div>
                        {(() => {
                          const meta = kanbanMeta[r.id];
                          const tags = (meta && meta.tags) 
                            ? (Array.isArray(meta.tags) ? meta.tags : String(meta.tags).split(',').filter(Boolean))
                            : (r.tags ? String(r.tags).split(',').filter(Boolean) : []);
                          if (tags.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-[150px]">
                              {tags.map((tag: string) => (
                                <span key={tag} className="inline-block px-1 py-0.5 bg-slate-50 text-slate-500 text-[8px] font-extrabold uppercase font-mono rounded border border-slate-200 truncate" title={tag}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`p-3 px-4 text-right font-bold text-slate-900 font-data-mono truncate ${getColWidthClass('amount')}`}>
                        {(r.total_subtotal_cotizacion || 0).toLocaleString('en-US', {
                          style: 'currency',
                          currency: r.informacion_general_moneda,
                          minimumFractionDigits: 0
                        })}
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('stage')}`}>
                        <EtapaCell
                          record={r}
                          role={role}
                          kanbanColumns={kanbanColumns}
                          kanbanMeta={kanbanMeta}
                          setKanbanMeta={setKanbanMeta}
                          onUpdateRecord={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('responsable')}`}>
                        <ResponsableCell
                          record={r}
                          role={role}
                          dbUsers={dbUsers || []}
                          kanbanMeta={kanbanMeta}
                          setKanbanMeta={setKanbanMeta}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('status')}`}>
                        <EstadoCell
                          record={r}
                          role={role}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('level')}`}>
                        <NivelTermoCell
                          record={r}
                          role={role}
                          currentTemp={getTemperature(r)}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('actions_followup')}`}>
                        <RegistrarAccionCell
                          record={r}
                          role={role}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('actions_history')}`}>
                        <HistorialAccionesCell
                          record={r}
                          role={role}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('checklist_progress')}`}>
                        <SubtasksProgressCell
                          record={r}
                          kanbanMeta={kanbanMeta}
                        />
                      </td>
                      <td className="p-3 px-4 text-right w-[8%] min-w-[100px] max-w-[120px]">
                        <div className="flex justify-end gap-1.5">
                          <button
                            id={`pdf-btn-${r.id}`}
                            onClick={() => {
                              if (r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion.trim().startsWith('http')) {
                                window.open(r.informacion_general_link_cotizacion.trim(), '_blank');
                              } else {
                                setPdfPromptRecord(r);
                                setPdfPromptOpen(true);
                              }
                            }}
                            title={r.informacion_general_link_cotizacion ? "Ver Cotización PDF" : "Sin Enlace de Cotización de Google Drive"}
                            className={`p-1.5 border rounded-lg transition-all shadow-3xs flex items-center justify-center ${
                              r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion.trim()
                                ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:shadow-2xs active:scale-95'
                                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 cursor-pointer active:scale-95'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                          <button
                            id={`edit-btn-${r.id}`}
                            onClick={() => handleOpenEditMode(r)}
                            disabled={role === 'Solo Lectura'}
                            title="Editar fila"
                            className={`p-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all shadow-3xs active:scale-95 ${role === 'Solo Lectura' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-btn-${r.id}`}
                            onClick={() => handleDelete(r.id, r.informacion_general_folio)}
                            disabled={role === 'Solo Lectura' || role === 'Vendedor'}
                            title={role !== 'Admin' ? 'Acción restringida para Admin' : 'Eliminar Folio'}
                            className={`p-1.5 border border-slate-200 bg-white hover:bg-red-50 text-red-600 rounded-lg transition-all shadow-3xs active:scale-95 ${role !== 'Admin' ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          {pageSize !== 'Todos' && filteredRecords.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 border-t border-slate-200 gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Mostrando <span className="font-semibold text-slate-700">{Math.min((currentPage - 1) * pageSize + 1, filteredRecords.length)}</span> a{' '}
                <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, filteredRecords.length)}</span> de{' '}
                <span className="font-semibold text-slate-700">{filteredRecords.length}</span> registros coincidentes
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-3xs"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200/50 rounded-md font-sans border border-slate-200">
                  {currentPage} / {Math.ceil(filteredRecords.length / pageSize)}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredRecords.length / pageSize)))}
                  disabled={currentPage >= Math.ceil(filteredRecords.length / pageSize)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-3xs"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      ) : (
        <>
          {renderKanbanView()}
        </>
      )}

      {renderDrawerLateralPanel()}
      {renderConfirmationCloseModal()}

      {/* MODAL: DETAIL WINDOW */}
      {isDetailOpen && selectedRecord && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl flex flex-col relative z-[9999]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[#0b1c30]">
                <FileText className="text-[#004ddf] w-5 h-5" />
                <h3 className="text-base font-semibold font-headline-md">
                  Ficha Técnica Comercial: Folio {selectedRecord.informacion_general_folio}
                </h3>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-1.5 hover:bg-slate-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-6 space-y-5 text-sm flex-1">
              {/* General Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">Corporativo B2B</p>
                  <p className="font-bold text-[#0b1c30]">{selectedRecord.informacion_general_cliente}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">Planta Industrial</p>
                  <p className="font-bold text-[#0b1c30]">{selectedRecord.informacion_general_planta}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">País / Localización</p>
                  <p className="text-slate-700 font-medium">{selectedRecord.cliente_pais} ({selectedRecord.cliente_ubicacion})</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">Ubicación Sistémica</p>
                  <p className="font-semibold text-slate-700">{getRegionGroup(selectedRecord)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">Estado actual en Embudo</p>
                  <div>
                    <span className={`inline-block px-2 text-[10px] font-bold py-0.5 rounded-full border ${getStatusBadge(selectedRecord.status_proyecto)}`}>
                      {selectedRecord.status_proyecto}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-0.5">Prioridad Térmica</p>
                  <div className="mt-0.5">{renderTemperatureBadge(getTemperature(selectedRecord))}</div>
                </div>
              </div>

              {/* Description & Technical notes */}
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 font-label-caps mb-1">Descripción del Proyecto</p>
                <div className="bg-slate-50 p-3 rounded text-[#0b1c30] font-medium border border-slate-200">
                  {selectedRecord.informacion_general_proyecto}
                </div>
              </div>

              {/* Monetary Breakdown */}
              <div className="bg-[#f8f9ff] border border-blue-100 p-4 rounded-md">
                <h4 className="text-xs font-bold text-[#004ddf] uppercase tracking-wider mb-2 font-label-caps">Cómputo Comercial &amp; IVA (16%)</h4>
                <div className="grid grid-cols-3 gap-3 font-data-mono text-xs">
                  <div>
                    <label className="text-[9px] text-slate-400 block font-sans">Suministros Hardware</label>
                    <span className="font-bold text-slate-900">
                      {selectedRecord.total_hardware_cotizacion.toLocaleString('en-US', { style: 'currency', currency: selectedRecord.informacion_general_moneda })}
                    </span>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block font-sans">Servicios de Campo</label>
                    <span className="font-bold text-slate-900">
                      {selectedRecord.total_servicios_cotizacion.toLocaleString('en-US', { style: 'currency', currency: selectedRecord.informacion_general_moneda })}
                    </span>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block font-sans">Subtotal Neto</label>
                    <span className="font-bold text-slate-900">
                      {selectedRecord.total_subtotal_cotizacion.toLocaleString('en-US', { style: 'currency', currency: selectedRecord.informacion_general_moneda })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 font-data-mono text-xs mt-3.5 border-t border-slate-200 pt-3">
                  <div>
                    <label className="text-[9px] text-slate-400 block font-sans">IVA Aplicable (16%)</label>
                    <span className="font-bold text-slate-950 text-xs">
                      {selectedRecord.total_iva_cotizacion.toLocaleString('en-US', { style: 'currency', currency: selectedRecord.informacion_general_moneda })}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-extrabold text-[#004ddf] block font-sans">Total de Contrato (IVA Incluido)</label>
                    <span className="font-extrabold text-[#004ddf] text-sm">
                      {selectedRecord.total_general_cotizacion.toLocaleString('en-US', { style: 'currency', currency: selectedRecord.informacion_general_moneda })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Obsolete substitutes reference */}
              {selectedRecord.sustituye_folio_anterior && (
                <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 p-2.5 rounded">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Trazabilidad de Sustitución
                  </p>
                  <p className="mt-0.5">Esta oferta comercial sustituye al folio obsoleto <strong>{selectedRecord.sustituye_folio_anterior}</strong>.</p>
                </div>
              )}

              {/* Delivery Details / Links */}
              <div className="space-y-1 text-xs">
                <p className="font-bold text-slate-500 font-sans">Enlaces y Documentos Oficiales:</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={selectedRecord.informacion_general_link_cotizacion}
                    target="_blank"
                    rel="referrer"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1 font-semibold"
                  >
                    <span>Abrir Cotización PDF en Google Drive</span>
                  </a>
                  {selectedRecord.link_orden_compra && (
                    <a
                      href={selectedRecord.link_orden_compra}
                      target="_blank"
                      rel="referrer"
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1 font-semibold border border-emerald-200"
                    >
                      <span>Orden de Compra Confirmada</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <footer className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-right">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="bg-[#0b1c30] text-white px-5 py-1.5 text-xs font-bold rounded"
              >
                Cerrar Ficha
              </button>
            </footer>
          </div>
        </div>,
        document.getElementById('root')!
      )}

      {/* MODAL: INPUT FORM FOR CREATE or UPDATE */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl flex flex-col relative z-[9999]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-base font-semibold font-headline-md text-[#0b1c30]">
                {isEditing ? `Modificar Oferta Comercial ${formFolio}` : 'Registrar Nuevo Proyecto Lead'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-sm flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Folio IdentificadorVT*
                  </label>
                  <input
                    type="text"
                    required
                    value={formFolio}
                    onChange={(e) => setFormFolio(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] font-data-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Moneda de Contrato*
                  </label>
                  <select
                    value={formMoneda}
                    onChange={(e) => setFormMoneda(e.target.value as 'USD' | 'MXN')}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  >
                    <option value="USD">USD - Dólares Estadounidenses</option>
                    <option value="MXN">MXN - Pesos Mexicanos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Nombre/Razón Social del Cliente Corportativo B2B*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grupo Bimbo, AstraZeneca..."
                  value={formCliente}
                  onChange={(e) => setFormCliente(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Planta Industrial Destino*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Planta Toluca"
                    value={formPlanta}
                    onChange={(e) => setFormPlanta(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    País Geográfico
                  </label>
                  <select
                    value={formPais}
                    onChange={(e) => setFormPais(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  >
                    <option value="México">México</option>
                    <option value="EE.UU.">EE.UU.</option>
                    <option value="LATAM">LATAM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Ciudad / Estado
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jalisco, CDMX, Texas"
                    value={formUbicacion}
                    onChange={(e) => setFormUbicacion(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Sustituye a Folio Anterior (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VT-1244"
                    value={formSustituye}
                    onChange={(e) => setFormSustituye(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none font-data-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Título del Proyecto / Alcance Técnico*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medición de Flujo Vapor"
                  value={formProyecto}
                  onChange={(e) => setFormProyecto(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              {/* Fiscal Calculation Simulator */}
              <div className="p-4 bg-slate-100 rounded border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase font-label-caps tracking-wider border-b border-slate-300 pb-1">
                  Presupuesto Comercial y Cómputo del IVA (16%)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                      Suministros Técnicos (Hardware)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formHardware}
                      onChange={(e) => setFormHardware(e.target.value === '' ? '' : Number(e.target.value))}
                      className="text-xs w-full bg-white border border-slate-200 p-1.5 focus:ring-1 text-[#0b1c30] font-data-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                      Servicios de Campo (Soporte/Calibración)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formServicios}
                      onChange={(e) => setFormServicios(e.target.value === '' ? '' : Number(e.target.value))}
                      className="text-xs w-full bg-white border border-slate-200 p-1.5 focus:ring-1 text-[#0b1c30] font-data-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs font-data-mono">
                  <div>
                    <span className="text-[10px] block text-slate-400 font-sans">Subtotal Neto</span>
                    <span className="font-bold text-slate-700">
                      ${subtotal.toLocaleString('en-US')} {formMoneda}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] block text-slate-400 font-sans">IVA 16% Obligatorio</span>
                    <span className="font-bold text-slate-700">
                      ${iva.toLocaleString('en-US')} {formMoneda}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block text-[#004ddf] font-sans">Total Neto</span>
                    <span className="font-extrabold text-[#004ddf] text-sm">
                      ${total.toLocaleString('en-US')} {formMoneda}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Enlace de Cotización en Drive (PDF / Doc)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={formLinkCotizacion}
                  onChange={(e) => setFormLinkCotizacion(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Estado de Proyecto
                  </label>
                  <select
                    value={formStatus || ''}
                    onChange={(e) => setFormStatus((e.target.value || null) as any)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  >
                    <option value="">[Sin definir / null]</option>
                    <option value="Propuesta">Propuesta</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Cerrado Ganado">Cerrado Ganado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Notas Comerciales e Información de la Cuenta
                </label>
                <textarea
                  placeholder="Describa requerimientos operacionales o técnicos específicos de planta..."
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={2}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 text-xs rounded hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#004ddf] text-white font-bold px-5 py-2 text-xs rounded hover:opacity-90 transition-opacity"
                >
                  Guardar Expediente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.getElementById('root')!
      )}


      {/* MODAL: PDF MISSING WARNING & HELP OPTIONS */}
      {pdfPromptOpen && pdfPromptRecord && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border-t border-l border-slate-100 border-r-2 border-b-6 border-b-[#004ddf]/30 border-r-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 relative z-[9999]">
            <div className="flex items-center gap-3 text-[#004ddf]">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-[inset_0_1px_2px_rgba(0,77,223,0.05)]">
                <FileText className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Enlace de Cotización No Encontrado
                </h3>
                <p className="text-xs text-slate-400 font-medium">Folio: {pdfPromptRecord.informacion_general_folio}</p>
              </div>
            </div>

            <div className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              No se ha registrado un enlace de Google Drive en la columna <code className="font-mono text-red-600 font-bold bg-white px-1.5 py-0.5 border border-slate-150 rounded">informacion_general_link_cotizacion</code> para el cliente <strong className="font-bold text-slate-900">{pdfPromptRecord.informacion_general_cliente}</strong>.
              <p className="mt-2">
                ¿Qué acción deseas realizar para este expediente?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => {
                  setPdfPromptOpen(false);
                  handleOpenDetail(pdfPromptRecord);
                  setPdfPromptRecord(null);
                }}
                className="w-full text-left px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#0b1c30] text-xs font-bold rounded-lg transition-all flex items-center justify-between cursor-pointer shadow-3xs"
              >
                <span>🔎 Abrir Ficha Técnica Comercial Completa</span>
                <span className="text-[10px] text-slate-400 font-mono font-medium">Detalles</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfPromptOpen(false);
                  handleOpenEditMode(pdfPromptRecord);
                  setPdfPromptRecord(null);
                }}
                className="w-full text-left px-4 py-2.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-lg transition-all flex items-center justify-between cursor-pointer shadow-3xs"
              >
                <span>✏️ Editar Expediente para Asignar Link PDF</span>
                <span className="text-[10px] text-blue-600 font-mono font-medium">Editar</span>
              </button>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPdfPromptOpen(false);
                    setPdfPromptRecord(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all border border-slate-250 cursor-pointer shadow-3xs active:scale-95"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.getElementById('root')!
      )}

      {/* MODAL: ASSIGN CARD TO KANBAN COLUMN */}
      {assignModalOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="font-bold text-slate-800">Agregar Lead a {assignTargetStage}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selecciona un proyecto disponible para integrarlo al tablero.</p>
            </header>

            {/* SEGMENTED FILTERS SECTION */}
            <div className="bg-white border-b border-slate-200 p-4 space-y-3 shrink-0">
              {/* Text Search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-405" />
                </span>
                <input
                  type="text"
                  value={assignModalSearch}
                  onChange={(e) => setAssignModalSearch(e.target.value)}
                  placeholder="Buscar por proyecto, cliente o folio..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700 placeholder-slate-400"
                />
                {assignModalSearch && (
                  <button
                    onClick={() => setAssignModalSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="text-[10px] font-sans bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-slate-505">Limpiar</span>
                  </button>
                )}
              </div>

              {/* Termo / Temperature fast pills */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtrar por nivel / termo:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['All', 'Hot', 'Warm', 'Cool', 'Win'].map((tempVal) => {
                    const getStyles = () => {
                      if (assignModalTempFilter === tempVal) {
                        switch (tempVal) {
                          case 'All': return 'bg-slate-805 text-white border-slate-900 shadow-3xs scale-[0.98] font-bold';
                          case 'Hot': return 'bg-red-600 text-white border-red-700 shadow-3xs scale-[0.98] font-bold';
                          case 'Warm': return 'bg-amber-500 text-white border-amber-600 shadow-3xs scale-[0.98] font-bold';
                          case 'Cool': return 'bg-blue-605 text-white border-blue-700 shadow-3xs scale-[0.98] font-bold';
                          case 'Win': return 'bg-emerald-600 text-white border-emerald-700 shadow-3xs scale-[0.98] font-bold';
                        }
                      } else {
                        switch (tempVal) {
                          case 'All': return 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300';
                          case 'Hot': return 'bg-red-50/40 hover:bg-red-50 text-red-700 border-red-100/70 hover:border-red-200';
                          case 'Warm': return 'bg-amber-50/40 hover:bg-amber-50 text-amber-700 border-amber-100/70 hover:border-amber-200';
                          case 'Cool': return 'bg-blue-50/40 hover:bg-blue-50 text-blue-700 border-blue-100/70 hover:border-blue-200';
                          case 'Win': return 'bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700 border-emerald-100/70 hover:border-emerald-200';
                        }
                      }
                      return '';
                    };

                    const getDisplayLabel = () => {
                      switch (tempVal) {
                        case 'All': return 'Todos';
                        case 'Hot': return '🔥 Hot';
                        case 'Warm': return '⚡ Warm';
                        case 'Cool': return '❄️ Cool';
                        case 'Win': return '🏆 Win';
                        default: return tempVal;
                      }
                    };

                    return (
                      <button
                        key={tempVal}
                        onClick={() => setAssignModalTempFilter(tempVal)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all cursor-pointer select-none font-semibold ${getStyles()}`}
                      >
                        {getDisplayLabel()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(() => {
              const unassignedRecords = records.filter(r => kanbanMeta[r.id]?.stage === 'Sin Asignar');
              
              const filtered = unassignedRecords.filter(r => {
                // 1. Text Search Filter
                if (assignModalSearch.trim() !== '') {
                  const q = assignModalSearch.toLowerCase().trim();
                  const folio = (r.informacion_general_folio || '').toLowerCase();
                  const name = (r.informacion_general_proyecto || '').toLowerCase();
                  const client = (r.informacion_general_cliente || '').toLowerCase();
                  if (!folio.includes(q) && !name.includes(q) && !client.includes(q)) {
                    return false;
                  }
                }

                // 2. Temperature Filter
                if (assignModalTempFilter !== 'All') {
                  const temp = getTemperature(r) || 'Cool';
                  if (temp !== assignModalTempFilter) {
                    return false;
                  }
                }
                return true;
              });

              const allFilteredSelected = filtered.length > 0 && filtered.every(r => selectedAssignIds.includes(r.id));
              const someFilteredSelected = filtered.length > 0 && filtered.some(r => selectedAssignIds.includes(r.id)) && !allFilteredSelected;

              return (
                <>
                  {filtered.length > 0 && (
                    <div className="bg-slate-100/75 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs shrink-0 select-none">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          checked={allFilteredSelected}
                          ref={el => {
                            if (el) {
                              el.indeterminate = someFilteredSelected;
                            }
                          }}
                          onChange={() => {
                            if (allFilteredSelected) {
                              // Deselect all filtered
                              const filteredIds = filtered.map(r => r.id);
                              setSelectedAssignIds(prev => prev.filter(id => !filteredIds.includes(id)));
                            } else {
                              // Select all filtered
                              const filteredIds = filtered.map(r => r.id);
                              setSelectedAssignIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                            }
                          }}
                        />
                        <span className="font-bold text-slate-700">
                          {selectedAssignIds.length > 0 
                            ? `${selectedAssignIds.length} seleccionados` 
                            : `Seleccionar todos (${filtered.length})`}
                        </span>
                      </label>

                      {selectedAssignIds.length > 0 && (
                        <button
                          onClick={() => setSelectedAssignIds([])}
                          className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Deseleccionar todos
                        </button>
                      )}
                    </div>
                  )}

                  <div className="p-4 overflow-y-auto bg-slate-50 flex-1 space-y-2">
                    {unassignedRecords.length === 0 ? (
                      <div className="text-sm text-center text-slate-400 py-6">
                        No hay proyectos nuevos o sin asignar. Puedes crear uno nuevo desde la vista de lista.
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="text-sm text-center text-slate-400 py-8 bg-white rounded-xl border border-dashed border-slate-200">
                        <p className="font-bold text-slate-500">Ningún proyecto coincide con los filtros</p>
                        <button 
                          onClick={() => { setAssignModalSearch(''); setAssignModalTempFilter('All'); }} 
                          className="mt-2 text-xs text-blue-600 hover:underline font-bold cursor-pointer"
                        >
                          Limpiar todos los filtros
                        </button>
                      </div>
                    ) : (
                      filtered.map(r => {
                        const currentTemp = getTemperature(r);
                        const isSelected = selectedAssignIds.includes(r.id);

                        return (
                          <div 
                            key={r.id} 
                            onClick={() => {
                              setSelectedAssignIds(prev => 
                                prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                              );
                            }}
                            className={`p-4 border rounded-xl shadow-xs hover:border-slate-350 transition-all flex flex-col gap-2.5 cursor-pointer select-none ${
                              isSelected 
                                ? 'bg-blue-50/40 border-blue-400 ring-2 ring-blue-100' 
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex gap-3 items-start min-w-0 flex-1">
                                {/* Custom Checkbox UI element */}
                                <div 
                                  className={`w-4.5 h-4.5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                    isSelected 
                                      ? 'bg-blue-600 border-blue-600 text-white' 
                                      : 'border-slate-300 bg-slate-50'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                                </div>

                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono text-slate-450 bg-slate-100 px-1.5 py-0.5 rounded font-bold shrink-0" title="Folio del proyecto">
                                      {r.informacion_general_folio || 'S/F'}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-800 truncate">
                                      {r.informacion_general_proyecto || 'Sin Nombre'}
                                    </h4>
                                  </div>
                                  
                                  {/* Client row with level/status info right-aligned next to it */}
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <p className="text-xs font-semibold text-slate-500 truncate">
                                      {r.informacion_general_cliente || 'Sin Cliente'}
                                    </p>
                                    <div className="shrink-0 scale-90 origin-right">
                                      {renderTemperatureBadge(currentTemp)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardStageChange(r.id, assignTargetStage);
                                  setAssignModalOpen(false);
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0"
                                title="Asignar este proyecto de forma individual inmediatamente"
                              >
                                Asignar ya
                              </button>
                            </div>

                            {r.notas_comerciales && r.notas_comerciales.trim() && (
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {r.notas_comerciales}
                              </p>
                            )}

                            <div className="flex items-center justify-between border-t border-dashed border-slate-150 pt-2.5 text-xs text-slate-650">
                              <div className="flex items-center gap-2.5">
                                <span>
                                  Subtotal: <strong className="font-bold text-slate-700">${(r.total_subtotal_cotizacion || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} {r.informacion_general_moneda || 'USD'}</strong>
                                </span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion.trim().startsWith('http')) {
                                    window.open(r.informacion_general_link_cotizacion.trim(), '_blank');
                                  } else {
                                    setPdfPromptRecord(r);
                                    setPdfPromptOpen(true);
                                  }
                                }}
                                title={r.informacion_general_link_cotizacion ? "Ver Cotización PDF" : "Sin Enlace de Cotización de Google Drive"}
                                className={`px-2 py-1 border rounded-lg transition-all flex items-center gap-1 font-bold text-[10.5px] cursor-pointer ${
                                  r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion.trim()
                                    ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-650 active:scale-95'
                                    : 'border-slate-200 bg-white text-slate-405 hover:bg-slate-50 active:scale-95'
                                }`}
                              >
                                <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>PDF</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <footer className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-505 font-semibold ml-2">
                      {selectedAssignIds.length > 0 ? (
                        <span className="text-blue-600">
                          🔥 {selectedAssignIds.length} seleccionados
                        </span>
                      ) : (
                        <span className="text-slate-400">Haz clic en las tarjetas para seleccionar múltiples</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAssignModalOpen(false)}
                        className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-all border border-transparent hover:border-slate-300 cursor-pointer"
                      >
                        Cerrar
                      </button>
                      {selectedAssignIds.length > 0 && (
                        <button
                          onClick={() => {
                            handleBulkStageChange(selectedAssignIds, assignTargetStage);
                            setAssignModalOpen(false);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-3xs active:scale-95 flex items-center gap-1.5"
                        >
                          <span>Asignar {selectedAssignIds.length} seleccionados</span>
                        </button>
                      )}
                    </div>
                  </footer>
                </>
              );
            })()}
          </div>
        </div>,
        document.getElementById('root')!
      )}

      {/* MODAL: CONFIGURE COLUMNS */}
      {columnConfigOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="font-bold text-slate-800">Configurar Columnas Kanban</h3>
              <p className="text-xs text-slate-500 mt-0.5">Agrega, edita o reordena columnas arrastrándolas por el indicador vertical. Al eliminar una columna, sus proyectos se conservarán y moverán a la lista "Sin Asignar" sin perder ningún dato.</p>
            </header>
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la nueva columna..."
                  value={newColumnName}
                  onChange={e => setNewColumnName(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    const val = newColumnName.trim();
                    if (val && !kanbanColumns.includes(val) && val !== 'Sin Asignar') {
                      setKanbanColumns([...kanbanColumns, val]);
                      setNewColumnName('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                  disabled={!newColumnName.trim() || kanbanColumns.includes(newColumnName.trim())}
                >
                  Agregar
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mt-4">
                {kanbanColumns.map((col, i) => {
                  const itemsInCol = records.filter(r => kanbanMeta[r.id]?.stage === col).length;
                  const isEditing = editingColumnIdx === i;
                  return (
                    <div 
                      key={col} 
                      draggable={editingColumnIdx === null}
                      onDragStart={(e) => {
                        setDraggedColumnIdx(i);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDragEnter={() => {
                        if (draggedColumnIdx !== null && draggedColumnIdx !== i) {
                          const updatedCols = [...kanbanColumns];
                          const draggedCol = updatedCols[draggedColumnIdx];
                          updatedCols.splice(draggedColumnIdx, 1);
                          updatedCols.splice(i, 0, draggedCol);
                          setKanbanColumns(updatedCols);
                          setDraggedColumnIdx(i);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedColumnIdx(null);
                      }}
                      className={`flex justify-between items-center p-3 transition-all ${
                        editingColumnIdx === null ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${draggedColumnIdx === i ? 'bg-blue-50/70 opacity-40' : 'bg-white hover:bg-slate-50'}`}
                      title={editingColumnIdx === null ? "Arrastra para reordenar" : undefined}
                    >
                      <div className="flex items-center gap-3 flex-1 mr-4 min-w-0">
                        {editingColumnIdx === null && (
                          <GripVertical className="w-3.5 h-3.5 text-slate-350 shrink-0 cursor-grab" />
                        )}
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-slate-400 text-xs font-mono shrink-0">
                          {i + 1}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingColumnName}
                            onChange={(e) => setEditingColumnName(e.target.value)}
                            className="flex-1 bg-white border border-blue-300 px-2 py-1 rounded text-sm outline-none focus:border-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingColumnIdx(null);
                            }}
                          />
                        ) : (
                          <span className="font-medium text-sm text-slate-700 truncate">{col}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => {
                                const newName = editingColumnName.trim();
                                if (!newName || (kanbanColumns.includes(newName) && newName !== col) || newName === 'Sin Asignar') {
                                  alert('Nombre inválido o ya existe.');
                                  return;
                                }
                                
                                const updatedCols = [...kanbanColumns];
                                updatedCols[i] = newName;
                                
                                // Update elements in meta
                                const newMeta = { ...kanbanMeta };
                                Object.keys(newMeta).forEach(key => {
                                  if (newMeta[key].stage === col) {
                                    newMeta[key].stage = newName;
                                  }
                                });

                                // Update wip limits
                                const newWip = { ...wipLimits };
                                if (newWip[col] !== undefined) {
                                  newWip[newName] = newWip[col];
                                  delete newWip[col];
                                }
                                
                                const newSorting = { ...columnSorting };
                                if (newSorting[col] !== undefined) {
                                  newSorting[newName] = newSorting[col];
                                  delete newSorting[col];
                                }
                                
                                setKanbanColumns(updatedCols);
                                setKanbanMeta(newMeta);
                                setWipLimits(newWip);
                                setColumnSorting(newSorting);
                                setEditingColumnIdx(null);
                              }}
                              className="px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded transition-colors bg-white border border-blue-205"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingColumnIdx(null)}
                              className="px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded transition-colors bg-white border border-slate-205"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                              {itemsInCol} {itemsInCol === 1 ? 'item' : 'items'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingColumnIdx(i);
                                setEditingColumnName(col);
                              }}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded transition-colors"
                              title="Editar columna"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setKanbanColumns(kanbanColumns.filter(c => c !== col));
                                
                                // Reset stage of all items matching this column to 'Sin Asignar'
                                const newMeta = { ...kanbanMeta };
                                records.forEach(r => {
                                  if (newMeta[r.id]?.stage === col) {
                                    newMeta[r.id] = {
                                      ...newMeta[r.id],
                                      stage: 'Sin Asignar',
                                      dateEnteredStage: '2026-06-14'
                                    };
                                  }
                                });
                                setKanbanMeta(newMeta);

                                // Remove wipLimits as well if they exist
                                const newWip = { ...wipLimits };
                                if (newWip[col]) delete newWip[col];
                                setWipLimits(newWip);
                              }}
                              className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                              title="Eliminar columna (proyectos se mantienen como Sin Asignar)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <footer className="bg-white p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setColumnConfigOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-colors border border-transparent hover:border-slate-300"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>,
        document.getElementById('root')!
      )}
    </div>
  );
}

function getStatusBadge(status: string) {
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
}

function renderTemperatureBadge(temp: string | null | undefined) {
  if (!temp) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-normal text-slate-400 bg-slate-50 border border-slate-200 italic">
        null
      </span>
    );
  }
  switch (temp) {
    case 'Win':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
          <Trophy className="w-3 h-3 text-yellow-600" />
          Win
        </span>
      );
    case 'Hot':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wide">
          <Flame className="w-3 h-3 text-red-500 animate-pulse" />
          Hot
        </span>
      );
    case 'Warm':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
          <Zap className="w-3 h-3 text-amber-600" />
          Warm
        </span>
      );
    case 'Cool':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
          <Snowflake className="w-3 h-3 text-blue-500" />
          Cool
        </span>
      );
  }
}

function TrazabilidadCell({ 
  record, 
  role, 
  onUpdate 
}: { 
  record: CRMRecord; 
  role: string; 
  onUpdate: (rec: CRMRecord) => void; 
}) {
  const [val, setVal] = useState(record.link_orden_compra || '');

  useEffect(() => {
    setVal(record.link_orden_compra || '');
  }, [record.link_orden_compra]);

  const handleSave = () => {
    const trimmed = val.trim();
    if (trimmed !== (record.link_orden_compra || '')) {
      onUpdate({ ...record, link_orden_compra: trimmed });
    }
  };

  return (
    <div className="flex items-center gap-1 justify-center max-w-[200px] mx-auto select-text">
      <input
        type="url"
        placeholder="v_drive_com/..."
        value={val}
        disabled={role === 'Solo Lectura'}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
            e.currentTarget.blur();
          }
        }}
        className={`w-full text-center text-[10px] uppercase font-bold py-1 px-1.5 bg-slate-50 border border-slate-200 rounded font-data-mono hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none ${
          record.link_orden_compra ? 'text-blue-700 bg-blue-50 border-blue-200 font-medium' : 'text-slate-400 font-normal italic'
        }`}
      />
      {record.link_orden_compra && record.link_orden_compra.startsWith('http') && (
        <a
          href={record.link_orden_compra}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 bg-white border border-slate-200 rounded shrink-0 transition-all shadow-xs"
          title="Abrir Google Drive"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function EstadoCell({
  record,
  role,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  onUpdate: (rec: CRMRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: ('Propuesta' | 'Negociación' | 'Cerrado Ganado' | null)[] = ['Propuesta', 'Negociación', 'Cerrado Ganado', null];

  const getStatusBadgeClass = (status: string | null | undefined) => {
    if (!status) return 'bg-slate-50 text-slate-400 border-slate-200 font-normal italic hover:bg-slate-100';
    if (status === 'Cerrado Ganado') return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100';
    if (status === 'Negociación') return 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100';
    return 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100';
  };

  const handleSelect = (status: 'Propuesta' | 'Negociación' | 'Cerrado Ganado' | null) => {
    if (role === 'Solo Lectura') return;
    
    let nextStatusProyecto = record.status_proyecto;
    if (status === 'Cerrado Ganado') {
      nextStatusProyecto = 'Win';
    } else if (status === 'Negociación' && nextStatusProyecto === 'Win') {
      nextStatusProyecto = 'Hot';
    } else if (status === 'Propuesta' && nextStatusProyecto === 'Win') {
      nextStatusProyecto = 'Cool';
    } else if (status === null) {
      nextStatusProyecto = null;
    }

    onUpdate({
      ...record,
      estado_proyecto: status,
      status_proyecto: nextStatusProyecto,
      
      // SYNC NEW FIELDS
      estado: status,
      nivel_termo: nextStatusProyecto
    });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={role === 'Solo Lectura'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`focus:outline-none transition-all active:scale-95 ${
          role === 'Solo Lectura' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-90'
        }`}
        title="Cambiar Fase Comercial"
      >
        <span className={`inline-block px-2 text-[10px] font-bold py-0.5 rounded-full border transition-all ${getStatusBadgeClass(record.estado_proyecto)}`}>
          {record.estado_proyecto || 'null'} <span className="ml-0.5 text-[8px] opacity-70">▼</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100">
          <div className="px-1 py-1 text-[8px] uppercase tracking-wider font-bold text-slate-400 text-center select-none font-sans">
            Fase Comercial
          </div>
          <div className="p-1 space-y-1">
            {options.map((opt) => (
              <button
                key={opt || 'null'}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between ${
                  record.estado_proyecto === opt ? 'bg-slate-50/50 font-bold text-blue-700' : 'text-slate-700'
                }`}
              >
                <span className={opt ? "" : "italic text-slate-400 font-normal"}>{opt || 'null'}</span>
                {record.estado_proyecto === opt && <span className="text-[9px] text-blue-600">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccionesSeguimientoCell({ 
  record, 
  role, 
  onUpdate 
}: { 
  record: CRMRecord; 
  role: string; 
  onUpdate: (rec: CRMRecord) => void; 
}) {
  const latestFollowup = record.acciones_seguimiento?.[0];
  const [val, setVal] = useState(latestFollowup?.notas || '');

  useEffect(() => {
    setVal(latestFollowup?.notas || '');
  }, [latestFollowup?.notas]);

  const handleSave = () => {
    const trimmed = val.trim();
    const currentNotes = latestFollowup?.notas || '';
    if (trimmed === currentNotes) return;

    let updatedAcciones = [...(record.acciones_seguimiento || [])];

    if (updatedAcciones.length === 0) {
      if (trimmed) {
        const isUserSaved = localStorage.getItem('verse_google_user');
        let creatorName = role === 'Admin' ? 'Administrador' : 'Vendedor';
        if (isUserSaved) {
          try {
            const parsed = JSON.parse(isUserSaved);
            if (parsed?.name) creatorName = parsed.name;
          } catch (e) {}
        }
        
        const newEntry: FollowupEntry = {
          id: `fl_${Date.now()}`,
          fecha: getMexicoCityDateTimeShortString(),
          tipo: 'Llamada Telefónica',
          creador: creatorName,
          notas: trimmed
        };
        updatedAcciones = [newEntry];
      }
    } else {
      updatedAcciones[0] = {
        ...updatedAcciones[0],
        notas: trimmed
      };
    }

    onUpdate({ ...record, acciones_seguimiento: updatedAcciones });
  };

  return (
    <div className="flex items-center gap-1 justify-center max-w-[200px] mx-auto select-text">
      <input
        type="text"
        placeholder="SIN ACCIÓN..."
        value={val}
        disabled={role === 'Solo Lectura'}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
            e.currentTarget.blur();
          }
        }}
        className={`w-full text-center text-[10px] uppercase font-bold py-1 px-1.5 bg-slate-50 border border-slate-200 rounded font-data-mono hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none ${
          latestFollowup?.notas ? 'text-indigo-700 bg-indigo-50 border-indigo-200 font-medium' : 'text-slate-400 font-normal italic'
        }`}
        title={latestFollowup?.notas || "Escribe para registrar/editar la última acción..."}
      />
    </div>
  );
}

function NivelTermoCell({
  record,
  role,
  currentTemp,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  currentTemp: 'Win' | 'Hot' | 'Warm' | 'Cool' | null;
  onUpdate: (rec: CRMRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const levels: ('Win' | 'Hot' | 'Warm' | 'Cool' | null)[] = ['Win', 'Hot', 'Warm', 'Cool', null];

  const handleSelect = (lvl: 'Win' | 'Hot' | 'Warm' | 'Cool' | null) => {
    if (role === 'Solo Lectura') return;
    let newStatus: 'Propuesta' | 'Negociación' | 'Cerrado Ganado' | null = record.estado_proyecto || null;
    if (lvl === 'Win') {
      newStatus = 'Cerrado Ganado';
    } else if (lvl === 'Hot' || lvl === 'Warm') {
      newStatus = 'Negociación';
    } else if (lvl === 'Cool') {
      newStatus = 'Propuesta';
    } else if (lvl === null) {
      newStatus = null;
    }
    onUpdate({ 
      ...record, 
      status_proyecto: lvl, 
      estado_proyecto: newStatus,
      prioridad_nivel: lvl
    });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={role === 'Solo Lectura'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`focus:outline-none transition-transform active:scale-95 ${
          role === 'Solo Lectura' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-90'
        }`}
        title="Cambiar prioridad"
      >
        {renderTemperatureBadge(currentTemp)}
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-28 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100">
          <div className="px-1 py-1 text-[8px] uppercase tracking-wider font-bold text-slate-400 text-center select-none font-sans">
            Prioridad
          </div>
          <div className="p-1 space-y-1">
            {levels.map((lvl) => (
              <button
                key={lvl || 'null'}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(lvl);
                }}
                className={`w-full flex items-center justify-center py-1 px-1.5 rounded hover:bg-slate-50 transition-colors ${
                  currentTemp === lvl ? 'bg-slate-50/50 ring-1 ring-slate-200' : ''
                }`}
              >
                {renderTemperatureBadge(lvl)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EtapaCell({
  record,
  role,
  kanbanColumns,
  kanbanMeta,
  setKanbanMeta,
  onUpdateRecord
}: {
  record: CRMRecord;
  role: string;
  kanbanColumns: string[];
  kanbanMeta: Record<string, any>;
  setKanbanMeta: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onUpdateRecord: (rec: CRMRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentStage = kanbanMeta[record.id]?.stage || record.etapa || 'Nuevo';
  const styles = getStageStyles(currentStage);

  const handleSelect = (newStage: string) => {
    if (role === 'Solo Lectura') return;

    const currentMeta = kanbanMeta[record.id] || {
      stage: record.etapa || 'Nuevo',
      dateEnteredStage: record.fecha_cambio_etapa || record.fecha_registro || getMexicoCityDateString(),
      responsable: record.responsable || '',
      subtasks: Array.isArray(record.__tareas) ? record.__tareas : [],
      tags: [],
      stagnation_days_limit: 5
    };

    const todayStr = getMexicoCityDateString();

    const updatedMeta = {
      ...kanbanMeta,
      [record.id]: {
        ...currentMeta,
        stage: newStage,
        dateEnteredStage: todayStr
      }
    };

    setKanbanMeta(updatedMeta);
    localStorage.setItem('verse_crm_kanban_meta', JSON.stringify(updatedMeta));

    onUpdateRecord({
      ...record,
      etapa: newStage,
      fecha_cambio_etapa: todayStr
    });

    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={role === 'Solo Lectura'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`focus:outline-none transition-all active:scale-95 ${
          role === 'Solo Lectura' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-90'
        }`}
        title="Cambiar Etapa Kanban"
      >
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${styles.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
          {currentStage} <span className="ml-0.5 text-[8px] opacity-70">▼</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100">
          <div className="px-1 py-1 text-[8px] uppercase tracking-wider font-bold text-slate-400 text-center select-none font-sans">
            Etapas del Kanban
          </div>
          <div className="p-1 space-y-1 max-h-60 overflow-y-auto">
            {kanbanColumns.map((col) => (
              <button
                key={col}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(col);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between ${
                  currentStage === col ? 'bg-slate-50/50 font-bold text-blue-700' : 'text-slate-700'
                }`}
              >
                <span>{col}</span>
                {currentStage === col && <span className="text-[9px] text-blue-600">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponsableCell({
  record,
  role,
  dbUsers = [],
  kanbanMeta,
  setKanbanMeta,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  dbUsers: UserAccount[];
  kanbanMeta: Record<string, any>;
  setKanbanMeta: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onUpdate: (rec: CRMRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentMeta = kanbanMeta[record.id];
  const matchedUser = record.contacto_asignado_id ? dbUsers.find(u => u.id === record.contacto_asignado_id) : null;
  const currentResponsable = matchedUser ? matchedUser.nombre : (currentMeta?.responsable || record.responsable || null);

  const handleSelect = (name: string | null) => {
    if (role === 'Solo Lectura') return;

    const selectedUser = dbUsers.find(u => u.nombre === name);
    const assignedId = selectedUser ? selectedUser.id : null;

    const updatedMeta = {
      ...kanbanMeta,
      [record.id]: {
        ...(currentMeta || {
          stage: record.etapa || 'Nuevo',
          dateEnteredStage: record.fecha_cambio_etapa || record.fecha_registro || getMexicoCityDateString(),
          subtasks: Array.isArray(record.__tareas) ? record.__tareas : [],
          tags: [],
          stagnation_days_limit: 5
        }),
        responsable: name,
        contacto_asignado_id: assignedId
      }
    };

    setKanbanMeta(updatedMeta);
    localStorage.setItem('verse_crm_kanban_meta', JSON.stringify(updatedMeta));

    onUpdate({
      ...record,
      responsable: name,
      contacto_asignado_id: assignedId
    });

    setIsOpen(false);
  };

  const initials = currentResponsable
    ? currentResponsable.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'N/A';

  const activeUsers = dbUsers.filter(u => u.estado === 'active');

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={role === 'Solo Lectura'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1 focus:outline-none transition-all active:scale-95 ${
          role === 'Solo Lectura' ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-90'
        }`}
        title="Asignar Responsable"
      >
        {currentResponsable ? (
          <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 py-0.5 px-1.5 rounded border border-slate-200">
            <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] font-black font-mono shadow-3xs">
              {initials}
            </div>
            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[70px]">
              {currentResponsable}
            </span>
            <span className="text-[7px] text-slate-400">▼</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 italic hover:text-slate-600 bg-slate-50 border border-dashed border-slate-300 py-0.5 px-1.5 rounded">
            Sin Asignar <span className="text-[7px]">▼</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100">
          <div className="px-1 py-1 text-[8px] uppercase tracking-wider font-bold text-slate-400 text-center select-none font-sans">
            Responsables Comerciales
          </div>
          <div className="p-1 space-y-1 max-h-60 overflow-y-auto">
            {activeUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(u.nombre);
                }}
                className={`w-full text-left px-2 py-1 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between ${
                  currentResponsable === u.nombre ? 'bg-slate-50/50 font-bold text-blue-700' : 'text-slate-700'
                }`}
              >
                <span>{u.nombre}</span>
                {currentResponsable === u.nombre && <span className="text-[9px] text-blue-600">✓</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className={`w-full text-left px-2 py-1 text-xs font-semibold rounded hover:bg-red-50 text-red-600 transition-colors flex items-center justify-between`}
            >
              <span className="italic">Desasignar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RegistrarAccionCell({
  record,
  role,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  onUpdate: (rec: CRMRecord) => void;
}) {
  const [val, setVal] = useState('');

  const handleSave = () => {
    const trimmed = val.trim();
    if (!trimmed) return;

    const isUserSaved = typeof window !== 'undefined' ? localStorage.getItem('verse_google_user') : null;
    const activeSessionUserName = isUserSaved ? JSON.parse(isUserSaved)?.name : 'Geovanni Andrade';

    const newEntry: FollowupEntry = {
      id: `f_add_${Math.random().toString(36).substring(2, 9)}`,
      fecha: getMexicoCityDateTimeShortString(),
      tipo: 'Llamada Telefónica',
      creador: activeSessionUserName || 'Geovanni Andrade',
      notas: trimmed
    };

    const updatedAcciones = [...(record.acciones_seguimiento || []), newEntry];

    onUpdate({
      ...record,
      acciones_seguimiento: updatedAcciones
    });

    setVal('');
  };

  return (
    <div className="flex items-center gap-1 justify-center max-w-[200px] mx-auto select-text">
      <input
        type="text"
        placeholder="Escribir acción..."
        value={val}
        disabled={role === 'Solo Lectura'}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
            e.currentTarget.blur();
          }
        }}
        className={`w-full text-center text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none text-slate-700 font-semibold`}
        title="Presiona Enter para agregar el avance de seguimiento..."
      />
    </div>
  );
}

function HistorialAccionesCell({
  record,
  role,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  onUpdate: (rec: CRMRecord) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const list = record.acciones_seguimiento || [];
  const latest = list.length > 0 ? list[list.length - 1] : null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="flex items-center gap-1.5 justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (list.length > 0) setIsOpen(!isOpen);
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border transition-all flex items-center gap-1 shrink-0 ${
            list.length > 0
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer'
              : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
          title={list.length > 0 ? "Ver historial de seguimiento" : "Sin historial registrado"}
        >
          <History className="w-3.5 h-3.5 text-blue-600" />
          <span>{list.length}</span>
        </button>

        {latest ? (
          <div className="text-[11px] text-slate-600 max-w-[120px] truncate text-left" title={latest.notas}>
            <span className="font-bold text-slate-750">{latest.tipo}:</span> {latest.notas}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">No hay logs</span>
        )}
      </div>

      {isOpen && list.length > 0 && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 text-left animate-in fade-in duration-150">
          <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono mb-2 border-b pb-1">
            Historial de Acciones ({list.length})
          </h5>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {[...list].reverse().map((item, idx) => (
              <div key={item.id || idx} className="text-xs border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono font-bold">
                  <span>{item.fecha}</span>
                  <span className="uppercase text-slate-500">{item.creador}</span>
                </div>
                <div className="font-bold text-slate-800 mt-0.5">{item.tipo}</div>
                <p className="text-slate-600 mt-1 leading-normal bg-slate-50 p-1.5 rounded text-[11px] border border-slate-100 whitespace-pre-wrap select-text">
                  {item.notas}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubtasksProgressCell({
  record,
  kanbanMeta
}: {
  record: CRMRecord;
  kanbanMeta: Record<string, any>;
}) {
  const meta = kanbanMeta[record.id];
  let subtasks: { id: string; text: string; completed: boolean }[] = [];
  
  if (meta && meta.subtasks) {
    subtasks = meta.subtasks;
  } else if (record.checklist_tasks) {
    subtasks = safeJsonParse<any[]>(record.checklist_tasks, [], 'checklist_tasks');
  }

  const total = subtasks.length;
  const completed = subtasks.filter(s => s.completed).length;

  if (total === 0) {
    return <span className="text-xs text-slate-400 italic">Sin tareas</span>;
  }

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 max-w-[120px] mx-auto select-none">
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="12"
              className="stroke-slate-100 fill-none"
              strokeWidth="2.5"
            />
            <circle
              cx="16"
              cy="16"
              r="12"
              className="stroke-blue-600 fill-none transition-all duration-300"
              strokeWidth="2.5"
              strokeDasharray={2 * Math.PI * 12}
              strokeDashoffset={2 * Math.PI * 12 * (1 - pct / 100)}
            />
          </svg>
          <span className="text-[9px] font-black font-mono text-slate-700">{pct}%</span>
        </div>
        
        <div className="text-left shrink-0">
          <div className="text-[10px] font-extrabold text-slate-800 leading-tight">
            {completed}/{total}
          </div>
          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Tareas
          </div>
        </div>
      </div>
    </div>
  );
}
