import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CRMRecord, UserRole, FollowupEntry, Contact, UserAccount } from '../types';
import { getMexicoCityDateString, getMexicoCityDateTimeShortString } from '../dateUtils';
import { toValidUUID, getCRMSettings, updateCRMSettings, subscribeToCRMSettings } from '../supabaseService';
import { safeJsonParse, safeRound } from '../utils/coreUtils';
import { 
  Plus, 
  Lock, 
  X,
  FileText,
  Activity,
  Check,
  Settings,
  AlertCircle
} from 'lucide-react';

import KanbanBoard, { KanbanMeta } from './Leads/KanbanBoard';
import LeadsTable from './Leads/LeadsTable';
import LeadDetailDrawer from './Leads/LeadDetailDrawer';

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
  // Active session details
  const isUserSaved = typeof window !== 'undefined' ? localStorage.getItem('verse_google_user') : null;
  const activeSessionUserName = isUserSaved ? JSON.parse(isUserSaved)?.name : 'Geovanni Andrade';

  const registeredCommercial = (dbUsers || [])
    .filter(u => u.estado === 'active')
    .map(u => u.nombre);

  const RESPONSIBLES = registeredCommercial.length > 0
    ? Array.from(new Set(registeredCommercial)).filter(Boolean) as string[]
    : ["Geovanni Andrade"];

  // Search and view states
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

  const [kanbanMeta, setKanbanMeta] = useState<Record<string, KanbanMeta>>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_meta');
    return saved ? JSON.parse(saved) : {};
  });

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const lastKnownServerStateRef = useRef<{ columns: string[]; wip: Record<string, number> } | null>(null);

  const [kanbanColumns, setKanbanColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_columns');
    return saved ? JSON.parse(saved) : ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
  });

  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetStage, setAssignTargetStage] = useState('');
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [assignModalTempFilter, setAssignModalTempFilter] = useState<string>('All');
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);

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

  // Load and subscribe to CRM settings in real-time
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
          lastKnownServerStateRef.current = {
            columns: settings.kanban_columns || [],
            wip: settings.wip_limits || {}
          };
          setSettingsId(settings.id);
          setKanbanColumns(settings.kanban_columns);
          setWipLimits(settings.wip_limits || {});
        } else {
          const initialColumns = ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
          const initialWip = {
            'Nuevo': 5,
            'Contactado': 4,
            'Cotizado': 8,
            'Negociación': 4,
            'Cerrado Ganado': 99,
            'Cerrado Perdido': 99,
          };
          lastKnownServerStateRef.current = {
            columns: initialColumns,
            wip: initialWip
          };
          const success = await updateCRMSettings({
            kanban_columns: initialColumns,
            wip_limits: initialWip
          }, url, key);

          if (success && active) {
            const reSettings = await getCRMSettings(url, key);
            if (reSettings && active) {
              lastKnownServerStateRef.current = {
                columns: reSettings.kanban_columns || [],
                wip: reSettings.wip_limits || {}
              };
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

    const url = localStorage.getItem('verse_supabase_url') || '';
    const key = localStorage.getItem('verse_supabase_key') || '';
    let subscription: any = null;

    if (url && key) {
      subscription = subscribeToCRMSettings((payload) => {
        if (payload.new && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
          if (active) {
            lastKnownServerStateRef.current = {
              columns: payload.new.kanban_columns || [],
              wip: payload.new.wip_limits || {}
            };
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

    // Skip push if state matches the last known server state or we have no changes
    if (lastKnownServerStateRef.current) {
      const serverCols = JSON.stringify(lastKnownServerStateRef.current.columns);
      const localCols = JSON.stringify(kanbanColumns);
      const serverWip = JSON.stringify(lastKnownServerStateRef.current.wip);
      const localWip = JSON.stringify(wipLimits);

      if (serverCols === localCols && serverWip === localWip) {
        return;
      }
    }

    const pushSettings = async () => {
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      if (!url || !key) return;

      lastKnownServerStateRef.current = {
        columns: kanbanColumns,
        wip: wipLimits
      };

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
    type?: 'archive' | 'delete';
  } | null>(null);
  const [closeReason, setCloseReason] = useState<string>('Ganado por precio');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggedOverCardId, setDraggedOverCardId] = useState<string | null>(null);

  // Persist local state on changes
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

  // Helper to map stage names to active custom columns
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

  // Synchronise existing master list records with the Kanban system
  useEffect(() => {
    if (records.length > 0) {
      let anyChange = false;
      const updatedMeta = { ...kanbanMeta };

      records.forEach((r, idx) => {
        const currentMeta = updatedMeta[r.id];
        let defaultTarget: string | null = null;

        if (r.etapa && kanbanColumns.includes(r.etapa)) {
          defaultTarget = r.etapa;
        } else if (r.estado_proyecto === 'Cerrado Ganado') {
          defaultTarget = 'Cerrado Ganado';
        } else if (r.estado_proyecto === 'Negociación') {
          defaultTarget = 'Negociación';
        } else if (r.estado_proyecto === 'Propuesta') {
          if (r.total_hardware_cotizacion !== null && r.total_hardware_cotizacion !== undefined && Number(r.total_hardware_cotizacion) > 0) {
            defaultTarget = 'Cotizado';
          } else if (r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion !== 'https://drive.google.com/file/d/new_quote_ref' && r.informacion_general_link_cotizacion !== '') {
            defaultTarget = 'Cotizado';
          } else if (r.status_proyecto === 'Warm') {
            defaultTarget = 'Contactado';
          } else {
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

        if (!defaultTarget) defaultTarget = 'Nuevo';
        const targetStage = resolveStageName(defaultTarget);

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

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const [pdfPromptOpen, setPdfPromptOpen] = useState(false);
  const [pdfPromptRecord, setPdfPromptRecord] = useState<CRMRecord | null>(null);

  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);

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

  const handleOpenDetail = (record: CRMRecord) => {
    setActiveDrawerRecordId(record.id);
  };

  const handleOpenEditMode = (record: CRMRecord) => {
    if (role === 'Solo Lectura') return;
    setIsEditing(true);
    setFormId(record.id);
    setFormFolio(record.informacion_general_folio || '');
    setFormCliente(record.informacion_general_cliente || '');
    setFormPlanta(record.informacion_general_planta || '');
    setFormPais(record.cliente_pais || 'México');
    setFormUbicacion(record.cliente_ubicacion || '');
    setFormProyecto(record.informacion_general_proyecto || '');
    setFormLinkCotizacion(record.informacion_general_link_cotizacion || '');
    setFormHardware(record.total_hardware_cotizacion !== null ? Number(record.total_hardware_cotizacion) : '');
    setFormServicios(record.total_servicios_cotizacion !== null ? Number(record.total_servicios_cotizacion) : '');
    setFormMoneda(record.informacion_general_moneda || 'USD');
    setFormStatus(record.estado_proyecto as any);
    setFormNotas(record.notas_comerciales || '');
    setFormSustituye(record.sustituye_folio_anterior || '');
    setIsFormOpen(true);
  };

  const handleOpenCreateMode = () => {
    if (role === 'Solo Lectura') return;
    setIsEditing(false);
    setFormId('');
    setFormFolio(`VT-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCliente('');
    setFormPlanta('');
    setFormPais('México');
    setFormUbicacion('');
    setFormProyecto('');
    setFormLinkCotizacion('');
    setFormHardware('');
    setFormServicios('');
    setFormMoneda('USD');
    setFormStatus('Propuesta');
    setFormNotas('');
    setFormSustituye('');
    setIsFormOpen(true);
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
      acciones_seguimiento: isEditing ? (existingRec?.acciones_seguimiento || []) : [],
      sustituye_folio_anterior: formSustituye || null,
      link_orden_compra: existingRec?.link_orden_compra || null,
      folio_orden_compra: existingRec?.folio_orden_compra || null,
      fecha_inicio_proyecto: existingRec?.fecha_inicio_proyecto || null,
      informacion_general_instalacion_incluida: existingRec?.informacion_general_instalacion_incluida ?? undefined,
      etapa: existingRec?.etapa || (formStatus ? resolveStageName(formStatus) : 'Nuevo'),
      nivel_termo: nextStatusProyecto || null,
      prioridad: existingRec?.prioridad ?? 0,
      estado: formStatus || null,
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
      }
      const descCambios = changes.length > 0 ? `, Cambios: [${changes.join(' | ')}]` : ' (Sin cambios)';
      onShowAudit('MODIFICACIÓN', `Actualizó expediente de ${formCliente} (Folio ${formFolio})${descCambios}`);
    } else {
      onAddRecord(payload);
      onShowAudit('ALTA REGISTRO', `Creó oferta para ${formCliente} (Folio ${formFolio}).`);
    }

    setIsFormOpen(false);
  };

  const getDaysInStage = (dateEntered: string) => {
    try {
      const today = new Date('2026-06-14'); // System metadata default date
      const entered = new Date(dateEntered);
      const diffTime = Math.abs(today.getTime() - entered.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return isNaN(diffDays) ? 0 : diffDays;
    } catch (e) {
      return 0;
    }
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

  // Drag and Drop helpers
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

  const getStageRecords = (stage: string): CRMRecord[] => {
    return records.filter(r => {
      const meta = kanbanMeta[r.id];
      return meta && meta.stage === stage;
    }).sort((a, b) => {
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

    if (updatedMeta[draggedId]) {
      updatedMeta[draggedId] = {
        ...updatedMeta[draggedId],
        stage: targetStage,
        dateEnteredStage: sourceStage !== targetStage ? getMexicoCityDateString() : updatedMeta[draggedId].dateEnteredStage
      };
      setKanbanMeta(updatedMeta);
    }

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

    newList.forEach((rec, idx) => {
      const newPriority = (newList.length - idx) * 10;
      const isDragged = rec.id === draggedId;

      const updatedRecord: CRMRecord = {
        ...rec,
        etapa: targetStage,
        prioridad: newPriority,
        nivel_termo: isDragged && newStatusProyecto !== undefined ? newStatusProyecto : (rec.nivel_termo || rec.status_proyecto || 'Cool'),
        estado: isDragged && newEstadoProyecto !== undefined ? newEstadoProyecto : (rec.estado || rec.estado_proyecto || 'Propuesta'),
        status_proyecto: isDragged && newStatusProyecto !== undefined ? newStatusProyecto : rec.status_proyecto,
        estado_proyecto: isDragged && newEstadoProyecto !== undefined ? newEstadoProyecto : rec.estado_proyecto
      };

      onUpdateRecord(updatedRecord);
    });

    const r = records.find(item => item.id === draggedId);
    if (sourceStage !== targetStage) {
      onShowAudit('MODIFICACIÓN', `Licitación comercial ${r?.informacion_general_folio || ''} movida a etapa [${targetStage}] con prioridad reajustada.`);
    } else {
      onShowAudit('MODIFICACIÓN', `Licitación comercial ${r?.informacion_general_folio || ''} reordenada verticalmente en [${targetStage}].`);
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

    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (!sourceCard) return;

    const currentMeta = kanbanMeta[recordId];
    const sourceStage = currentMeta?.stage || 'Nuevo';

    const defaultTarget = getDefaultStageForCustom(targetStage);
    if (sourceStage !== targetStage && (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido')) {
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
      return;
    }

    let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
    const targetIdx = listWithoutDragged.findIndex(r => r.id === targetCardId);
    
    if (targetIdx !== -1) {
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

    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (!sourceCard) return;

    const defaultTarget = getDefaultStageForCustom(targetStage);
    if (sourceStage !== targetStage && (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido')) {
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
      return;
    }

    let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
    listWithoutDragged.push(sourceCard);

    saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
  };

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

  const handleCardStageChange = (recordId: string, targetStage: string) => {
    const currentMeta = kanbanMeta[recordId];
    if (!currentMeta) return;
    const sourceStage = currentMeta.stage;
    if (sourceStage === targetStage) return;

    const defaultTarget = getDefaultStageForCustom(targetStage);

    if (defaultTarget === 'Cerrado Ganado' || defaultTarget === 'Cerrado Perdido') {
      setPendingDrag({ recordId, targetStage, sourceStage });
      setCloseReason(defaultTarget === 'Cerrado Ganado' ? 'Ganado por precio' : 'Perdido por presupuesto');
      setCloseNotes('');
    } else {
      const stageRecords = getStageRecords(targetStage);
      const sourceCard = records.find(r => r.id === recordId);
      if (sourceCard) {
        let listWithoutDragged = stageRecords.filter(r => r.id !== recordId);
        listWithoutDragged.push(sourceCard);
        saveNewListPrioritiesAndStage(listWithoutDragged, targetStage, recordId, sourceStage);
      }
    }
  };

  const handleBulkStageChange = (recordIds: string[], targetStage: string) => {
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
        dateEnteredStage: getMexicoCityDateString()
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
    
    const stageRecords = getStageRecords(targetStage);
    const sourceCard = records.find(r => r.id === recordId);
    if (sourceCard) {
      const defaultTarget = getDefaultStageForCustom(targetStage);
      
      const updatedCard: CRMRecord = {
        ...sourceCard,
        estado_proyecto: defaultTarget === 'Cerrado Ganado' ? 'Cerrado Ganado' : null,
        status_proyecto: defaultTarget === 'Cerrado Ganado' ? 'Win' : 'Cool',
        notas_comerciales: closeNotes ? `${sourceCard.notas_comerciales || ''}\n[Cierre ${targetStage} - Motivo: ${closeReason}]: ${closeNotes}` : sourceCard.notas_comerciales,
        etapa: targetStage,
        nivel_termo: defaultTarget === 'Cerrado Ganado' ? 'Win' : 'Cool',
        estado: defaultTarget === 'Cerrado Ganado' ? 'Cerrado Ganado' : 'Propuesta'
      };

      const updatedMeta = { ...kanbanMeta };
      if (updatedMeta[recordId]) {
        updatedMeta[recordId] = {
          ...updatedMeta[recordId],
          stage: targetStage,
          dateEnteredStage: getMexicoCityDateString(),
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

  const handleCancelCloseDrag = () => {
    setPendingDrag(null);
  };

  // Stats summary panel calculations
  const totalCotizacionesUSD = useMemo(() => {
    const sum = records.reduce((acc, r) => {
      let val = r.total_general_cotizacion || 0;
      if (r.informacion_general_moneda === 'MXN') {
        val = val / exchangeRate;
      }
      return acc + val;
    }, 0);
    return safeRound(sum);
  }, [records, exchangeRate]);

  const totalActivoUSD = useMemo(() => {
    const sum = records
      .filter((r) => r.estado_proyecto !== 'Cerrado Ganado')
      .reduce((acc, r) => {
        let val = r.total_general_cotizacion || 0;
        if (r.informacion_general_moneda === 'MXN') {
          val = val / exchangeRate;
        }
        return acc + val;
      }, 0);
    return safeRound(sum);
  }, [records, exchangeRate]);

  const averageQuotaUSD = useMemo(() => {
    return records.length > 0 ? safeRound(totalCotizacionesUSD / records.length) : 0;
  }, [records, totalCotizacionesUSD]);

  // Modals renderings
  const renderConfirmationCloseModal = () => {
    if (!pendingDrag) return null;
    const { recordId, targetStage, type = 'archive' } = pendingDrag;
    const r = records.find(rec => rec.id === recordId);
    if (!r) return null;

    if (type === 'delete') {
      return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm p-4 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4 relative z-[10000]">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">¿Eliminar Expediente Comercial?</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta acción eliminará de forma irreversible la cotización folio <strong className="font-bold text-slate-800">{r.informacion_general_folio}</strong> del cliente {r.informacion_general_cliente}.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingDrag(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-3xs border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteRecord(recordId);
                  onShowAudit('BAJA', `Expediente comercial ${r.informacion_general_folio} de ${r.informacion_general_cliente} eliminado.`);
                  setPendingDrag(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-3xs cursor-pointer"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    const isGanado = targetStage.toLowerCase().includes('ganado');

    return createPortal(
      <div className="fixed inset-0 bg-[#071322]/45 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 border border-slate-200">
          <header className="flex items-center gap-3">
            <div className={`p-3 rounded-full border ${isGanado ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Finalizar Expediente Comercial</h3>
              <p className="text-xs text-slate-450 font-semibold font-mono">Folio: {r.informacion_general_folio}</p>
            </div>
          </header>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">Motivo de Cierre</label>
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 py-2 px-3 text-xs font-bold rounded-lg outline-none cursor-pointer"
              >
                {isGanado ? (
                  <>
                    <option value="Ganado por precio">Ganado por precio</option>
                    <option value="Ganado por tiempo de entrega">Ganado por tiempo de entrega</option>
                    <option value="Ganado por solvencia técnica">Ganado por solvencia técnica</option>
                    <option value="Ganado por relación comercial">Ganado por relación comercial</option>
                  </>
                ) : (
                  <>
                    <option value="Perdido por presupuesto">Perdido por presupuesto</option>
                    <option value="Perdido por tiempo de entrega">Perdido por tiempo de entrega</option>
                    <option value="Perdido por solvencia técnica">Perdido por solvencia técnica</option>
                    <option value="Cancelado por el cliente">Cancelado por el cliente</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">Notas Adicionales de Cierre</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
                placeholder="Ingresa notas adicionales de cierre de expediente comercial..."
                className="w-full bg-slate-50 border border-slate-200 p-3 text-xs rounded-lg outline-none"
              />
            </div>
          </div>

          <footer className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              onClick={handleCancelCloseDrag}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-3xs border border-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmCloseDrag}
              className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition shadow-3xs cursor-pointer ${
                isGanado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Guardar Cierre
            </button>
          </footer>
        </div>
      </div>,
      document.body
    );
  };

  const handleSaveDetailDrawer = (updatedRecord: CRMRecord) => {
    // 1. Sincronizar kanbanMeta para mantener la consistencia local
    const updatedMeta = {
      ...kanbanMeta,
      [updatedRecord.id]: {
        stage: updatedRecord.etapa || 'Nuevo',
        dateEnteredStage: updatedRecord.fecha_cambio_etapa || updatedRecord.fecha_registro || getMexicoCityDateString(),
        responsable: updatedRecord.responsable || '',
        subtasks: Array.isArray(updatedRecord.__tareas) ? updatedRecord.__tareas : [],
        tags: updatedRecord.tags ? updatedRecord.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        stagnation_days_limit: updatedRecord.stagnation_days_limit !== undefined && updatedRecord.stagnation_days_limit !== null ? Number(updatedRecord.stagnation_days_limit) : 5
      }
    };
    setKanbanMeta(updatedMeta);
    localStorage.setItem('verse_crm_kanban_meta', JSON.stringify(updatedMeta));

    // 2. Propagar la actualización hacia el estado principal y Supabase
    onUpdateRecord(updatedRecord);

    // 3. Registrar en la bitácora de auditoría
    onShowAudit('MODIFICACIÓN', `Cambios guardados para la licitación ${updatedRecord.informacion_general_folio}.`);

    // 4. Cerrar la consola lateral
    setActiveDrawerRecordId(null);
  };

  const renderDrawerLateralPanel = () => {
    const activeRecord = records.find(r => r.id === activeDrawerRecordId) || null;
    return (
      <LeadDetailDrawer
        isOpen={!!activeDrawerRecordId}
        record={activeRecord}
        onClose={() => setActiveDrawerRecordId(null)}
        onSave={handleSaveDetailDrawer}
        contacts={contacts}
        dbUsers={dbUsers}
        kanbanColumns={kanbanColumns}
        role={role}
      />
    );
  };

  const renderTemperatureBadge = (status: string | null | undefined) => {
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
            {status || 'COOL'}
          </span>
        );
    }
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
            Proyectos Registrados
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold text-slate-800">{records.length}</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Monto Neto Acumulado
          </span>
          <div className="text-lg font-bold text-blue-700 font-mono mt-0.5">
            ${totalCotizacionesUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] font-sans font-bold">USD</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Pipeline Activo
          </span>
          <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
            ${totalActivoUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] font-sans font-bold">USD</span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md shadow-3xs border border-slate-200">
          <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono">
            Monto Promedio Contrato
          </span>
          <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
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
        <LeadsTable
          records={records}
          role={role}
          dbUsers={dbUsers}
          exchangeRate={exchangeRate}
          kanbanMeta={kanbanMeta}
          setKanbanMeta={setKanbanMeta}
          kanbanColumns={kanbanColumns}
          onUpdateRecord={onUpdateRecord}
          onDeleteRecord={onDeleteRecord}
          setActiveDrawerRecordId={setActiveDrawerRecordId}
          setEditingRecord={handleOpenEditMode}
          setDeleteConfirmId={(id) => setPendingDrag(id ? { recordId: id, targetStage: 'Nuevo', sourceStage: 'Nuevo', type: 'delete' } : null)}
          handleAddNewCard={handleOpenCreateMode}
          getDaysInStage={getDaysInStage}
          getStageStyles={getStageStyles}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      ) : (
        <KanbanBoard
          records={records}
          role={role}
          dbUsers={dbUsers}
          kanbanMeta={kanbanMeta}
          setKanbanMeta={setKanbanMeta}
          kanbanColumns={kanbanColumns}
          setKanbanColumns={setKanbanColumns}
          wipLimits={wipLimits}
          setWipLimits={setWipLimits}
          onUpdateRecord={onUpdateRecord}
          setActiveDrawerRecordId={setActiveDrawerRecordId}
          setPdfPromptRecord={setPdfPromptRecord}
          setPdfPromptOpen={setPdfPromptOpen}
          getDaysInStage={getDaysInStage}
          handleCardDragStart={handleCardDragStart}
          handleCardDragEnd={handleCardDragEnd}
          handleCardDragOverCard={handleCardDragOverCard}
          handleCardDropOnCard={handleCardDropOnCard}
          handleCardDropOnColumn={handleCardDropOnColumn}
          dragOverStage={dragOverStage}
          setDragOverStage={setDragOverStage}
          draggingCardId={draggingCardId}
          draggedOverCardId={draggedOverCardId}
          columnSorting={columnSorting}
          setColumnSorting={setColumnSorting as any}
          handleAddNewCardInStage={handleAddNewCardInStage}
          setColumnConfigOpen={setColumnConfigOpen}
          stageThresholds={STAGE_THRESHOLDS}
          getStageStyles={getStageStyles}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}

      {renderDrawerLateralPanel()}
      {renderConfirmationCloseModal()}

      {/* MODAL: DETAIL WINDOW */}
      {pdfPromptOpen && pdfPromptRecord && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border-t border-l border-slate-100 border-r-2 border-b-6 border-b-[#004ddf]/30 border-r-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 relative z-[9999]">
            <div className="flex items-center gap-3 text-[#004ddf]">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                <FileText className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Enlace de Cotización No Encontrado
                </h3>
                <p className="text-xs text-slate-450 font-medium">Folio: {pdfPromptRecord.informacion_general_folio}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              No se ha registrado un enlace de Google Drive para la cotización del cliente <strong className="font-bold text-slate-900">{pdfPromptRecord.informacion_general_cliente}</strong>.
              <p className="mt-2 font-semibold">
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all border border-slate-250 cursor-pointer shadow-3xs"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: ASSIGN CARD TO KANBAN COLUMN */}
      {assignModalOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="font-bold text-slate-800">Agregar Lead a {assignTargetStage}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selecciona un proyecto disponible para integrarlo al tablero.</p>
            </header>

            <div className="bg-white border-b border-slate-200 p-4 space-y-3 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={assignModalSearch}
                  onChange={(e) => setAssignModalSearch(e.target.value)}
                  placeholder="Buscar por proyecto, cliente o folio..."
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-700 placeholder-slate-400"
                />
                {assignModalSearch && (
                  <button
                    onClick={() => setAssignModalSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="text-[10px] font-sans bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded">Limpiar</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtrar por nivel / termo:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['All', 'Hot', 'Warm', 'Cool', 'Win'].map((tempVal) => {
                    const active = assignModalTempFilter === tempVal;
                    return (
                      <button
                        key={tempVal}
                        onClick={() => setAssignModalTempFilter(tempVal)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all cursor-pointer font-semibold ${
                          active 
                            ? 'bg-slate-800 text-white border-slate-900 shadow-3xs' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tempVal}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(() => {
              const unassignedRecords = records.filter(r => kanbanMeta[r.id]?.stage === 'Sin Asignar' || !kanbanMeta[r.id]);
              const filtered = unassignedRecords.filter(r => {
                if (assignModalSearch.trim() !== '') {
                  const q = assignModalSearch.toLowerCase().trim();
                  const folio = (r.informacion_general_folio || '').toLowerCase();
                  const name = (r.informacion_general_proyecto || '').toLowerCase();
                  const client = (r.informacion_general_cliente || '').toLowerCase();
                  if (!folio.includes(q) && !name.includes(q) && !client.includes(q)) return false;
                }
                if (assignModalTempFilter !== 'All') {
                  const temp = r.status_proyecto || 'Cool';
                  if (temp !== assignModalTempFilter) return false;
                }
                return true;
              });

              return (
                <div className="p-4 overflow-y-auto bg-slate-50 flex-1 space-y-2">
                  {filtered.length === 0 ? (
                    <div className="text-sm text-center text-slate-400 py-6">
                      No hay proyectos nuevos coincidentes con el filtro.
                    </div>
                  ) : (
                    filtered.map(r => (
                      <div 
                        key={r.id} 
                        onClick={() => {
                          handleCardStageChange(r.id, assignTargetStage);
                          setAssignModalOpen(false);
                        }}
                        className="p-4 border border-slate-200 bg-white rounded-xl shadow-xs hover:border-slate-350 transition-all flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-450 bg-slate-100 px-1.5 py-0.5 rounded font-bold">{r.informacion_general_folio}</span>
                            <h4 className="text-xs font-bold text-slate-800">{r.informacion_general_proyecto}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">{r.informacion_general_cliente}</p>
                        </div>
                        <span className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold">Asignar</span>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

            <footer className="bg-white p-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-all border border-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: INPUT FORM FOR CREATE or UPDATE */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl flex flex-col relative z-[9999]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-base font-semibold text-[#0b1c30]">
                {isEditing ? `Modificar Oferta Comercial ${formFolio}` : 'Registrar Nuevo Proyecto Lead'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-sm flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Folio IdentificadorVT*
                  </label>
                  <input
                    type="text"
                    required
                    value={formFolio}
                    onChange={(e) => setFormFolio(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Moneda de Contrato*
                  </label>
                  <select
                    value={formMoneda}
                    onChange={(e) => setFormMoneda(e.target.value as 'USD' | 'MXN')}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none cursor-pointer"
                  >
                    <option value="USD">USD - Dólares Estadounidenses</option>
                    <option value="MXN">MXN - Pesos Mexicanos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nombre/Razón Social del Cliente Corporativo B2B*
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    País Geográfico
                  </label>
                  <select
                    value={formPais}
                    onChange={(e) => setFormPais(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none cursor-pointer"
                  >
                    <option value="México">México</option>
                    <option value="EE.UU.">EE.UU.</option>
                    <option value="LATAM">LATAM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
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
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider border-b border-slate-300 pb-1">
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
                      className="text-xs w-full bg-white border border-slate-200 p-1.5 focus:ring-1 text-[#0b1c30] font-mono"
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
                      className="text-xs w-full bg-white border border-slate-200 p-1.5 focus:ring-1 text-[#0b1c30] font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs font-mono">
                  <div>
                    Subtotal Neto: <strong className="font-bold text-slate-800">${subtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })} {formMoneda}</strong>
                  </div>
                  <div>
                    IVA (0%): <strong className="font-bold text-slate-800">$0 {formMoneda}</strong>
                  </div>
                  <div>
                    Monto Total: <strong className="font-bold text-blue-700">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} {formMoneda}</strong>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Enlace de Cotización en Google Drive (Opcional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={formLinkCotizacion}
                  onChange={(e) => setFormLinkCotizacion(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Notas de Negociación / Comentarios Comerciales
                </label>
                <textarea
                  placeholder="Comentarios adicionales del estado de la propuesta..."
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={3}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg border border-transparent hover:border-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-3xs cursor-pointer"
                >
                  {isEditing ? 'Guardar Cambios VT' : 'Registrar Entrada VT'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
