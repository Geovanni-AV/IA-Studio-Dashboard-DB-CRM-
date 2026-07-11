import React, { useState } from 'react';
import { CRMRecord, UserRole, PurchaseOrder, Contact, OCItemPartida } from '../types';
import { getMexicoCityDateString } from '../dateUtils';
import { useData } from '../contexts/DataContext';
import { ocService, crmService } from '../supabaseService';
import { 
  FileCheck, 
  BookOpen, 
  AlertCircle, 
  Lock, 
  Plus, 
  ExternalLink, 
  Calendar, 
  Coins, 
  User, 
  Layers, 
  FileSpreadsheet, 
  CornerDownRight, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  DollarSign,
  Search,
  SlidersHorizontal,
  Clock,
  FileText,
  X
} from 'lucide-react';

interface PurchaseOrdersSectionProps {
  records: CRMRecord[];
  role: UserRole;
  onUpdateRecord: (record: CRMRecord) => void;
  onShowAudit: (action: string, details: string) => void;
  prefilledLead?: CRMRecord | null;
  clearPrefilledLead?: () => void;
}

const getSupabaseConfig = () => {
  const prodUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const prodKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  return {
    url: prodUrl || localStorage.getItem('verse_supabase_url') || '',
    key: prodKey || localStorage.getItem('verse_supabase_key') || ''
  };
};

export default function PurchaseOrdersSection({
  records,
  role,
  onUpdateRecord,
  onShowAudit,
  prefilledLead,
  clearPrefilledLead
}: PurchaseOrdersSectionProps) {
  // Access global context
  const { contacts, purchaseOrders, setPurchaseOrders, showToast } = useData();

  // Selected opportunity for new PO link
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Creation Form values
  const [folioOC, setFolioOC] = useState('');
  const [linkOC, setLinkOC] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [instalacionIncluida, setInstalacionIncluida] = useState(true);

  // Active edit PO representation
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  // Modals visibility state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Auto pre-fill if land with prefilledLead state (Fase 3: CRM -> OC Bridge)
  React.useEffect(() => {
    if (prefilledLead) {
      setSelectedProjectId(prefilledLead.id);
      setFolioOC(prefilledLead.folio_orden_compra || '');
      setLinkOC(prefilledLead.link_orden_compra || '');
      setFechaInicio(prefilledLead.fecha_inicio_proyecto || getMexicoCityDateString());
      setInstalacionIncluida(prefilledLead.informacion_general_instalacion_incluida !== false);
      setIsCreateModalOpen(true);
    }
  }, [prefilledLead]);

  // FASE 4: Estados para resiliencia y retroalimentación visual
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [leadsDisponibles, setLeadsDisponibles] = useState<CRMRecord[]>([]);

  // FASE 4: Aislamiento de Promesas para carga robusta y descentralizada de DB_OC y DB CRM
  React.useEffect(() => {
    let active = true;

    const fetchOrdenesCompra = async () => {
      try {
        const ocs = await ocService.getPurchaseOrders();
        if (active) {
          console.log('[DEBUG OC] Total registros recibidos:', ocs.length);
          setPurchaseOrders(ocs);
        }
      } catch (error) {
        console.error("Fallo crítico al cargar OCs:", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const fetchProyectosVinculables = async () => {
      try {
        const proyectos = await crmService.getProyectosWin();
        if (active) {
          setLeadsDisponibles(proyectos);
        }
      } catch (error) {
        console.warn("Fallo no crítico: No se pudieron cargar los proyectos para vincular", error);
      }
    };

    fetchOrdenesCompra();
    fetchProyectosVinculables();

    return () => {
      active = false;
    };
  }, [setPurchaseOrders]);

  // Track expanded partidas for won POs
  const [expandedPartidas, setExpandedPartidas] = useState<Record<string, boolean>>({});
  const [estatusFilter, setEstatusFilter] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchingDB, setIsSearchingDB] = useState<boolean>(false);
  const [selectedPOForDrawer, setSelectedPOForDrawer] = useState<PurchaseOrder | null>(null);

  // Filter won contracts (Cerrado Ganado)
  const wonContracts = records.filter((r) => r.estado_proyecto === 'Cerrado Ganado');
  const pendingContracts = records.filter((r) => r.estado_proyecto !== 'Cerrado Ganado');

  const selectProjects = leadsDisponibles.length > 0 ? [...leadsDisponibles] : [...pendingContracts];
  if (prefilledLead && !selectProjects.some(p => p.id === prefilledLead.id)) {
    const foundRecord = records.find(r => r.id === prefilledLead.id);
    if (foundRecord) {
      selectProjects.unshift(foundRecord);
    } else {
      selectProjects.unshift(prefilledLead);
    }
  }

  const togglePartidas = (id: string) => {
    setExpandedPartidas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculatePOTotal = (po: PurchaseOrder) => {
    if (!po.__partidas || po.__partidas.length === 0) return po.monto;
    return po.__partidas.reduce((sum, item: any) => {
      const q = parseInt(item.cantidad ?? item.Cantidad_Ordenada, 10) || 0;
      const p = parseFloat(item.precio_unitario ?? item.Precio_Unitario) || 0;
      return sum + (q * p);
    }, 0);
  };

  // Convert generic ID into valid numeric primary key
  const getNumericId = (stringId: string) => {
    let numericId = parseInt(stringId.replace(/\D/g, ''), 10);
    if (isNaN(numericId)) {
      let hash = 0;
      for (let i = 0; i < stringId.length; i++) {
        hash = (hash * 31 + stringId.charCodeAt(i)) & 0x7FFFFFFF;
      }
      numericId = hash || Math.floor(Math.random() * 10000000);
    }
    return numericId;
  };

  // High performance deep search directly in Supabase Postgres (JSONB)
  const handleDatabaseSearch = async () => {
    setIsSearchingDB(true);
    try {
      if (searchQuery.trim()) {
        const textResults = await ocService.getPurchaseOrders({ 
          estatus: estatusFilter === 'Todos' ? undefined : estatusFilter,
          search: searchQuery 
        });

        const partidasResults = await ocService.searchInPartidas(searchQuery);

        const combinedMap = new Map<string, PurchaseOrder>();
        textResults.forEach(r => combinedMap.set(String(r.id), r));
        partidasResults.forEach(r => combinedMap.set(String(r.id), r));

        const combined = Array.from(combinedMap.values());
        
        setPurchaseOrders(prev => {
          const updated = [...prev];
          combined.forEach(newItem => {
            const idx = updated.findIndex(p => String(p.id) === String(newItem.id));
            if (idx !== -1) {
              updated[idx] = newItem;
            } else {
              updated.unshift(newItem);
            }
          });
          return updated;
        });

        showToast(`Búsqueda en BD completada. Se encontraron ${combined.length} resultados indexados.`, 'success');
      } else {
        const results = await ocService.getPurchaseOrders({ 
          estatus: estatusFilter === 'Todos' ? undefined : estatusFilter 
        });
        setPurchaseOrders(results);
        showToast(`Listado de órdenes sincronizado con la base de datos.`, 'info');
      }
    } catch (err: any) {
      console.warn("Fallo de consulta en caliente (usando cache local):", err);
      showToast(`Búsqueda local activada: ${err.message || err}`, 'info');
    } finally {
      setIsSearchingDB(false);
    }
  };

  // Compute filtered purchase orders list dynamically
  const filteredOrders = React.useMemo(() => {
    let result = [...purchaseOrders];

    if (estatusFilter && estatusFilter !== 'Todos') {
      result = result.filter(order =>
        (order.estatusPago ?? 'Pendiente de cobro') === estatusFilter
      );
    }

    const term = (searchQuery ?? '').trim().toLowerCase();
    if (term !== '') {
      result = result.filter(order =>
        (order.folioOC ?? '').toLowerCase().includes(term) ||
        (order.cliente ?? '').toLowerCase().includes(term) ||
        (order.proyecto ?? '').toLowerCase().includes(term) ||
        (order.id ?? '').toLowerCase().includes(term)
      );
    }

    return result;
  }, [purchaseOrders, estatusFilter, searchQuery]);

  // Dynamic KPIs metrics calculations
  const kpis = React.useMemo(() => {
    const totalOrders = purchaseOrders.length;
    const pendingOrders = purchaseOrders.filter(o => (o.estatusPago || 'Pendiente de cobro') === 'Pendiente de cobro');
    const cobradoOrders = purchaseOrders.filter(o => o.estatusPago === 'Cobrado');
    
    let totalUSD = 0;
    let totalMXN = 0;
    let pendingUSD = 0;
    let pendingMXN = 0;
    let cobradoUSD = 0;
    let cobradoMXN = 0;

    purchaseOrders.forEach(o => {
      const isUSD = o.moneda === 'USD';
      const amt = o.monto || 0;
      const status = o.estatusPago || 'Pendiente de cobro';

      if (status !== 'Cancelada') {
        if (isUSD) {
          totalUSD += amt;
          if (status === 'Pendiente de cobro') pendingUSD += amt;
          if (status === 'Cobrado') cobradoUSD += amt;
        } else {
          totalMXN += amt;
          if (status === 'Pendiente de cobro') pendingMXN += amt;
          if (status === 'Cobrado') cobradoMXN += amt;
        }
      }
    });

    const formatValueShort = (usd: number, mxn: number) => {
      const parts: string[] = [];
      if (usd > 0) {
        if (usd >= 100000) {
          parts.push(`$${(usd / 1000000).toFixed(1)}M USD`);
        } else {
          parts.push(`$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`);
        }
      }
      if (mxn > 0) {
        if (mxn >= 100000) {
          parts.push(`$${(mxn / 1000000).toFixed(1)}M MXN`);
        } else {
          parts.push(`$${mxn.toLocaleString('en-US', { maximumFractionDigits: 0 })} MXN`);
        }
      }
      return parts.length > 0 ? parts.join(' + ') : '$0';
    };

    return {
      totalCount: totalOrders,
      totalValueStr: formatValueShort(totalUSD, totalMXN),
      pendingCount: pendingOrders.length,
      pendingValueStr: formatValueShort(pendingUSD, pendingMXN),
      cobradoCount: cobradoOrders.length,
      cobradoValueStr: formatValueShort(cobradoUSD, cobradoMXN)
    };
  }, [purchaseOrders]);

  // Robust fallback lookup for CRMRecords to prevent showing Drive File ID
  const getLinkedCRMRecord = (order: PurchaseOrder): CRMRecord => {
    // 1. Try leadId
    if (order.leadId) {
      const found = records.find(r => String(r.id) === String(order.leadId));
      if (found) return found;
    }
    // 2. Try matching CRM Folio exactly
    if (order.folioRefCRM && order.folioRefCRM.length < 20 && !order.folioRefCRM.includes('/')) {
      const found = records.find(r => r.informacion_general_folio === order.folioRefCRM);
      if (found) return found;
    }
    // 3. Try matching PO Folio
    if (order.folioOC) {
      const found = records.find(r => r.folio_orden_compra === order.folioOC);
      if (found) return found;
    }
    // 4. Try matching Client & Project
    if (order.cliente && order.proyecto) {
      const found = records.find(r => 
        r.informacion_general_cliente === order.cliente && 
        r.informacion_general_proyecto === order.proyecto
      );
      if (found) return found;
    }
    // 5. Fallback object
    return {
      id: `crm_fallback_${order.id}`,
      informacion_general_folio: (order.folioRefCRM && order.folioRefCRM.length < 20 && !order.folioRefCRM.includes('/')) ? order.folioRefCRM : 'N/A',
      fecha_registro: order.fechaInicio,
      informacion_general_cliente: order.cliente,
      informacion_general_proyecto: order.proyecto,
      informacion_general_planta: '',
      cliente_pais: 'México',
      cliente_ubicacion: '',
      informacion_general_link_cotizacion: '',
      total_hardware_cotizacion: 0,
      total_servicios_cotizacion: 0,
      total_subtotal_cotizacion: 0,
      total_iva_cotizacion: 0,
      total_general_cotizacion: order.monto,
      informacion_general_moneda: order.moneda,
      estado_proyecto: 'Cerrado Ganado',
      folio_orden_compra: order.folioOC,
      link_orden_compra: order.linkOC,
      fecha_inicio_proyecto: order.fechaInicio,
      notas_comerciales: '',
      acciones_seguimiento: [],
    };
  };

  const getCleanFolioCRM = (order: PurchaseOrder, linkedCRM: CRMRecord) => {
    if (linkedCRM.informacion_general_folio && linkedCRM.informacion_general_folio.length < 20 && !linkedCRM.informacion_general_folio.includes('/')) {
      return linkedCRM.informacion_general_folio;
    }
    if (order.folioRefCRM && order.folioRefCRM.length < 20 && !order.folioRefCRM.includes('/')) {
      return order.folioRefCRM;
    }
    return 'N/A';
  };

  const getAntiguedadStr = (fechaStr: string) => {
    if (!fechaStr) return null;
    const parts = fechaStr.split('-');
    if (parts.length !== 3) return null;
    
    // YYYY-MM-DD
    const poDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    // Current simulated local date: 2026-07-11
    const currentDate = new Date(2026, 6, 11);
    
    const diffTime = currentDate.getTime() - poDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Fecha futura';
    if (diffDays === 0) return 'Lanzamiento hoy';
    if (diffDays === 1) return 'Lanzado ayer';
    return `${diffDays} d`;
  };

  const getPrioridadBadge = (record: CRMRecord) => {
    const p = record.prioridad_nivel || record.status_proyecto || 'Warm';
    switch (p) {
      case 'Win':
      case 'Hot':
        return (
          <span className="bg-rose-50 text-rose-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-rose-200 uppercase tracking-wide">
            Alta Prioridad
          </span>
        );
      case 'Warm':
        return (
          <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wide">
            Prioridad Media
          </span>
        );
      default:
        return (
          <span className="bg-slate-50 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-slate-200 uppercase tracking-wide">
            Prioridad Baja
          </span>
        );
    }
  };

  // Map and create a new rich PO record
  const handleFormalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para vincular órdenes de compra.`);
      return;
    }
    if (!selectedProjectId) {
      alert('Por favor, elija un proyecto para vincular.');
      return;
    }
    if (!folioOC.trim()) {
      alert('Debe de ingresar un folio válido de Orden de Compra.');
      return;
    }

    const baseProject = records.find((r) => r.id === selectedProjectId);
    if (!baseProject) return;

    const updatedRecord: CRMRecord = {
      ...baseProject,
      estado_proyecto: 'Cerrado Ganado',
      status_proyecto: 'Win',
      folio_orden_compra: folioOC,
      link_orden_compra: linkOC || 'https://drive.google.com/open?id=standard_po_placeholder',
      fecha_inicio_proyecto: fechaInicio || getMexicoCityDateString(),
      informacion_general_instalacion_incluida: instalacionIncluida
    };

    const numericId = getNumericId(`po_ext_${baseProject.informacion_general_folio}`);
    const newPO: PurchaseOrder = {
      id: String(numericId),
      folioOC: folioOC,
      linkOC: linkOC || 'https://drive.google.com/open?id=standard_po_placeholder',
      fechaInicio: fechaInicio || getMexicoCityDateString(),
      instalacionIncluida: instalacionIncluida,
      monto: baseProject.total_general_cotizacion || 0,
      moneda: baseProject.informacion_general_moneda === 'USD' ? 'USD' : 'MXN',
      cliente: baseProject.informacion_general_cliente || '',
      proyecto: baseProject.informacion_general_proyecto || '',
      folioRefCRM: baseProject.informacion_general_folio || '',
      estatusPago: 'Pendiente de cobro',
      replacedById: null,
      leadId: baseProject.id,
      __partidas: []
    };

    const config = getSupabaseConfig();
    if (config.url && config.key) {
      try {
        await ocService.closeDealAndLinkOC(
          baseProject.id,
          numericId,
          folioOC,
          linkOC || 'https://drive.google.com/open?id=standard_po_placeholder',
          fechaInicio || getMexicoCityDateString(),
          instalacionIncluida,
          baseProject.total_general_cotizacion || 0,
          baseProject.informacion_general_moneda === 'USD' ? 'USD' : 'MXN',
          baseProject.informacion_general_cliente || '',
          baseProject.informacion_general_proyecto || '',
          baseProject.informacion_general_folio || '',
          []
        );
      } catch (error: any) {
        console.error("Error executing unified closeDealAndLinkOC transaction:", error);
        alert(`Error al registrar y vincular la Orden de Compra en el servidor: ${error.message || error}`);
        return;
      }
    }

    onUpdateRecord(updatedRecord);

    setPurchaseOrders(prev => {
      const index = prev.findIndex(p => String(p.id) === String(newPO.id));
      if (index !== -1) {
        return prev.map(p => String(p.id) === String(newPO.id) ? newPO : p);
      }
      return [newPO, ...prev];
    });

    onShowAudit('MODIFICACIÓN', `Formalizó y Vinculó Orden de Compra ${folioOC} para folio ${baseProject.informacion_general_folio} (${baseProject.informacion_general_cliente}) mediante canal transaccional seguro.`);
    
    setSelectedProjectId('');
    setFolioOC('');
    setLinkOC('');
    setFechaInicio('');
    setIsCreateModalOpen(false);
    showToast(`¡Orden de compra ${folioOC} vinculada con éxito!`, 'success');

    if (clearPrefilledLead) {
      clearPrefilledLead();
    }
  };

  // Launch editing session
  const handleStartEdit = (record: CRMRecord, richPO?: PurchaseOrder) => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para modificar detalles de órdenes.`);
      return;
    }
    
    if (richPO) {
      setEditingPO({ ...richPO });
    } else {
      const numericId = getNumericId(`po_ext_${record.informacion_general_folio}`);
      setEditingPO({
        id: String(numericId),
        folioOC: record.folio_orden_compra || `PENDIENTE-${record.informacion_general_folio}`,
        linkOC: record.link_orden_compra || '',
        fechaInicio: record.fecha_inicio_proyecto || record.fecha_registro || '',
        instalacionIncluida: record.informacion_general_instalacion_incluida ?? true,
        monto: record.total_general_cotizacion || 0,
        moneda: record.informacion_general_moneda === 'USD' ? 'USD' : 'MXN',
        cliente: record.informacion_general_cliente || '',
        proyecto: record.informacion_general_proyecto || '',
        folioRefCRM: record.informacion_general_folio || '',
        estatusPago: 'Pendiente de cobro',
        replacedById: null,
        leadId: null,
        __partidas: []
      });
    }
  };

  // Save changes to Supabase
  const handleSaveB2B = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPO) return;

    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para guardar órdenes.`);
      return;
    }

    if (editingPO.estatusPago === 'Reemplazada' && !editingPO.replacedById) {
      alert('⚠️ Error de Validación B2B: El estatus "Reemplazada" requiere especificar de forma obligatoria qué orden sustituta la reemplaza.');
      return;
    }

    const finalMonto = calculatePOTotal(editingPO);
    const finalPO: PurchaseOrder = {
      ...editingPO,
      monto: finalMonto
    };

    try {
      const ok = await ocService.updateOCStatus(
        finalPO.id, 
        finalPO.estatusPago || 'Pendiente de cobro', 
        finalPO.replacedById,
        {
          folioOC: finalPO.folioOC,
          linkOC: finalPO.linkOC,
          fechaInicio: finalPO.fechaInicio,
          instalacionIncluida: finalPO.instalacionIncluida,
          monto: finalPO.monto,
          moneda: finalPO.moneda,
          cliente: finalPO.cliente,
          proyecto: finalPO.proyecto,
          folioRefCRM: finalPO.folioRefCRM,
          leadId: finalPO.leadId,
          __partidas: finalPO.__partidas
        }
      );

      if (ok) {
        setPurchaseOrders(prev => {
          const index = prev.findIndex(p => String(p.id) === String(finalPO.id));
          if (index !== -1) {
            return prev.map(p => String(p.id) === String(finalPO.id) ? finalPO : p);
          }
          return [finalPO, ...prev];
        });
        onShowAudit('MODIFICACIÓN', `Actualizó detalle B2B de Orden de Compra ${finalPO.folioOC} (Estatus: ${finalPO.estatusPago})`);
        showToast('¡Detalle de orden guardado con éxito!', 'success');
        setEditingPO(null);
      } else {
        setPurchaseOrders(prev => {
          const index = prev.findIndex(p => String(p.id) === String(finalPO.id));
          if (index !== -1) {
            return prev.map(p => String(p.id) === String(finalPO.id) ? finalPO : p);
          }
          return [finalPO, ...prev];
        });
        onShowAudit('MODIFICACIÓN', `Actualizó localmente Orden de Compra ${finalPO.folioOC}`);
        showToast('Guardado en memoria local.', 'info');
        setEditingPO(null);
      }
    } catch (err: any) {
      console.error("Fallo de persistencia al guardar en Supabase:", err);
      alert(`Error al persistir cambios: ${err.message || err}`);
    }
  };

  const renderEstatusBadge = (estatus: string) => {
    switch (estatus) {
      case 'Cobrado':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wide">
            Cobrado
          </span>
        );
      case 'Cancelada':
        return (
          <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-3 py-1 rounded-full border border-rose-200 uppercase tracking-wide">
            Cancelada
          </span>
        );
      case 'Reemplazada':
        return (
          <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-3 py-1 rounded-full border border-purple-200 uppercase tracking-wide">
            Reemplazada
          </span>
        );
      case 'Activa':
        return (
          <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-3 py-1 rounded-full border border-sky-200 uppercase tracking-wide">
            Activa
          </span>
        );
      default:
        return (
          <span className="bg-amber-100 text-amber-850 text-[10px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wide">
            Pendiente de cobro
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 fade-in text-left">
      {/* HEADER SECTION (MOCKUP STYLED) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes de Compra</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl font-medium">
            Cartera activa de documentos formalizados. Gestiona estatus de cobro, partidas y vinculación con el CRM.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 border border-slate-900 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nueva OC
        </button>
      </div>

      {/* KPI METRICS CARDS ROW (DYNAMIC & POLISHED) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: CARTERA TOTAL */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">CARTERA TOTAL</p>
          <p className="text-3xl font-extrabold text-[#004ddf] tracking-tight mt-1">{kpis.totalCount}</p>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold">documentos activos</p>
        </div>

        {/* Card 2: VALOR TOTAL */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">VALOR TOTAL</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 truncate" title={kpis.totalValueStr}>
            {kpis.totalValueStr}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold">USD + MXN acumulado</p>
        </div>

        {/* Card 3: PENDIENTE COBRO */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">PENDIENTE COBRO</p>
          <p className="text-3xl font-extrabold text-amber-600 tracking-tight mt-1">{kpis.pendingCount}</p>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold truncate" title={`${kpis.pendingValueStr} en espera`}>
            {kpis.pendingValueStr} en espera
          </p>
        </div>

        {/* Card 4: COBRADO */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">COBRADO</p>
          <p className="text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{kpis.cobradoCount}</p>
          <p className="text-xs text-slate-500 mt-1.5 font-semibold truncate" title={`${kpis.cobradoValueStr} cobrado`}>
            {kpis.cobradoValueStr} este período
          </p>
        </div>
      </div>

      {/* SEARCH AND FILTER CONTROLS BAR (MOCKUP STYLED) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        {/* Search Field */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por folio, cliente o concepto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2.5 rounded-lg text-xs outline-none focus:border-slate-400 font-semibold text-slate-800 placeholder-slate-400 transition-colors"
          />
          <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDatabaseSearch}
            disabled={isSearchingDB}
            className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isSearchingDB ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Busca directamente en las partidas de Supabase"
          >
            {isSearchingDB ? (
              <>
                <span className="animate-spin text-xs">⏳</span> Buscando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 text-slate-500" /> Búsqueda en BD
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setEstatusFilter('Todos');
              showToast('Filtros restablecidos', 'info');
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-850 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" /> Filtros
          </button>
        </div>
      </div>

      {/* STATUS TABS (HIGH CONTRAST & LEGIBILITY) */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {['Todos', 'Pendiente de cobro', 'Cobrado', 'Cancelada', 'Reemplazada', 'Activa'].map((statusOption) => {
            const isActive = estatusFilter === statusOption;
            const count = purchaseOrders.filter(order => {
              const est = order.estatusPago || 'Pendiente de cobro';
              return statusOption === 'Todos' || est === statusOption;
            }).length;

            return (
              <button
                key={statusOption}
                type="button"
                onClick={() => setEstatusFilter(statusOption)}
                className={`text-xs font-semibold pb-2.5 transition-all relative outline-none cursor-pointer ${
                  isActive 
                    ? 'text-[#004ddf] font-bold border-b-2 border-[#004ddf]' 
                    : 'text-slate-550 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300'
                }`}
              >
                <span>{statusOption}</span>
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  isActive 
                    ? 'bg-blue-100 text-[#004ddf]' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CARTERA CARDS PORTFOLIO (MOCKUP HI-FI REDESIGN) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500 space-y-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Sincronizando con base de datos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-450 italic text-sm bg-white border border-slate-200 rounded-xl">
            Ninguna orden de compra formalizada coincide con los filtros aplicados.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const linkedCRM = getLinkedCRMRecord(order);
            const richPO = order;
            const estatus = richPO?.estatusPago || 'Pendiente de cobro';
            const leadVinculado = richPO?.leadId ? contacts.find(co => co.id === richPO.leadId) : null;
            
            const replacementPO = richPO?.replacedById 
              ? purchaseOrders.find(po => getNumericId(po.id) === richPO.replacedById)
              : null;

            const hasPartidas = Array.isArray(richPO?.__partidas) && richPO.__partidas.length > 0;
            const totalCalculado = richPO ? calculatePOTotal(richPO) : linkedCRM.total_general_cotizacion || 0;
            const folioCrmLimpio = getCleanFolioCRM(order, linkedCRM);

            // Hide Project name if N/A or empty
            const showProjectName = linkedCRM.informacion_general_proyecto && 
                                    linkedCRM.informacion_general_proyecto !== 'N/A' && 
                                    linkedCRM.informacion_general_proyecto.trim() !== '';

            // Calculate age (antigüedad)
            const antigüedadStr = getAntiguedadStr(linkedCRM.fecha_inicio_proyecto || order.fechaInicio);

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-350 hover:shadow-xs transition-all space-y-4"
              >
                {/* Upper row: Customer information and price/status */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900 tracking-tight">
                      {linkedCRM.informacion_general_cliente || order.cliente}
                    </h4>
                    
                    {/* Folio link */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#004ddf] font-mono tracking-wide">
                        {order.folioOC}
                      </span>
                      {folioCrmLimpio !== 'N/A' && (
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                          Ref CRM: {folioCrmLimpio}
                        </span>
                      )}
                      {showProjectName && (
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-xs" title={linkedCRM.informacion_general_proyecto || ''}>
                          • {linkedCRM.informacion_general_proyecto}
                        </span>
                      )}
                    </div>

                    {/* Meta Row: Date, Contact person, Antigüedad, Priority */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-1">
                      {order.fechaInicio && (
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {order.fechaInicio}
                        </span>
                      )}
                      
                      {leadVinculado && (
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {leadVinculado.nombre}
                        </span>
                      )}

                      {antigüedadStr && (
                        <span className="flex items-center gap-1 font-semibold text-[#004ddf] bg-blue-50/70 border border-blue-100 px-1.5 py-0.2 rounded-md">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {antigüedadStr}
                        </span>
                      )}

                      {getPrioridadBadge(linkedCRM)}
                    </div>
                  </div>

                  {/* Pricing and Payment Status Column */}
                  <div className="flex flex-col items-end shrink-0 md:text-right space-y-1">
                    <p className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">
                      {totalCalculado.toLocaleString('en-US', {
                        style: 'currency',
                        currency: order.moneda || 'USD',
                        minimumFractionDigits: 0
                      })} <span className="text-xs text-slate-400 font-bold">{order.moneda || 'USD'}</span>
                    </p>
                    <div>
                      {renderEstatusBadge(estatus)}
                    </div>
                  </div>
                </div>

                {/* Relational details line (Contact linked & replacement order logs) */}
                {replacementPO && (
                  <div className="bg-purple-50/50 border border-purple-100 p-2.5 rounded-lg text-xs text-purple-800 flex items-center gap-2">
                    <CornerDownRight className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="font-bold">Sustituida por Orden de Compra:</span>
                    <span className="font-mono font-extrabold bg-purple-100 px-2 py-0.5 border border-purple-200 rounded text-purple-900">
                      {replacementPO.folioOC}
                    </span>
                  </div>
                )}

                {/* Expandable Partidas Breakdown table */}
                {hasPartidas && expandedPartidas[order.id] && (
                  <div className="mt-2 bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                        Partidas Desglosadas ({richPO?.__partidas?.length})
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">
                        B2B Logística
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                            <th className="py-2 px-1">Concepto / Partida</th>
                            <th className="py-2 px-1 text-center w-12">Cant</th>
                            <th className="py-2 px-1 text-right w-24">Precio Unit.</th>
                            <th className="py-2 px-1 text-right w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {richPO.__partidas.map((item: any, idx: number) => {
                            const cant = item.cantidad ?? item.Cantidad_Ordenada ?? 1;
                            const unitPrice = item.precio_unitario ?? item.Precio_Unitario ?? 0;
                            const itemTotal = cant * unitPrice;
                            return (
                              <tr key={idx} className="hover:bg-slate-100/50">
                                <td className="py-2 px-1 font-sans text-slate-800">{item.descripcion || item.Descripcion_Articulo || 'Sin descripción'}</td>
                                <td className="py-2 px-1 text-center font-mono text-[10px]">{cant}</td>
                                <td className="py-2 px-1 text-right font-mono text-[10px] text-slate-500">
                                  {unitPrice.toLocaleString('en-US', {
                                    style: 'currency',
                                    currency: order.moneda || 'USD',
                                    minimumFractionDigits: 0
                                  })}
                                </td>
                                <td className="py-2 px-1 text-right font-mono text-[10px] text-slate-900">
                                  {itemTotal.toLocaleString('en-US', {
                                    style: 'currency',
                                    currency: order.moneda || 'USD',
                                    minimumFractionDigits: 0
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* BOTTOM ACTION BUTTONS ROW (HOMOGENEOUS, ELEGANT, ALIGNED TO MOCKUP) */}
                <div className="border-t border-slate-150/70 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* PDF Button */}
                    {order.linkOC && (
                      <a
                        href={order.linkOC}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-3xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> PDF
                      </a>
                    )}

                    {/* Partidas Button (Toggles expansion) */}
                    <button
                      type="button"
                      onClick={() => togglePartidas(order.id)}
                      className={`px-3.5 py-2 border text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer ${
                        hasPartidas 
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' 
                          : 'bg-slate-50/50 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                      disabled={!hasPartidas}
                    >
                      <Layers className={`w-3.5 h-3.5 ${hasPartidas ? 'text-slate-400' : 'text-slate-300'}`} />
                      <span>Partidas ({richPO?.__partidas?.length || 0})</span>
                    </button>

                    {/* Detalle B2B button */}
                    {role !== 'Solo Lectura' && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(linkedCRM, richPO)}
                        className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Detalle B2B
                      </button>
                    )}

                    {/* Drawer B2B button */}
                    {hasPartidas && (
                      <button
                        type="button"
                        onClick={() => setSelectedPOForDrawer(richPO)}
                        className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer"
                        title="Ver desglose completo de partidas"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" /> Desglose
                      </button>
                    )}
                  </div>

                  {/* Toggle expansion text & chevron on far right */}
                  {hasPartidas && (
                    <button
                      type="button"
                      onClick={() => togglePartidas(order.id)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{expandedPartidas[order.id] ? 'ocultar partidas' : 'ver partidas'}</span>
                      {expandedPartidas[order.id] ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================
         MODAL: VINCULAR NUEVA ORDEN DE COMPRA (CREATION)
         ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Plus className="text-[#004ddf] w-5 h-5" />
                Vincular Orden de Compra (OC)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  if (clearPrefilledLead) clearPrefilledLead();
                }}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleFormalize} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {prefilledLead && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#004ddf] flex items-center gap-1">📌 Lead pre-seleccionado:</span>
                    <span className="font-semibold text-slate-700">
                      {prefilledLead.informacion_general_folio} • {prefilledLead.informacion_general_cliente} ({prefilledLead.informacion_general_proyecto})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProjectId('');
                      setFolioOC('');
                      setLinkOC('');
                      setFechaInicio('');
                      if (clearPrefilledLead) clearPrefilledLead();
                    }}
                    className="text-xs bg-white hover:bg-slate-100 border border-slate-200 text-slate-750 font-bold px-2.5 py-1.5 rounded-lg transition-all shadow-3xs cursor-pointer"
                  >
                    Descartar
                  </button>
                </div>
              )}

              {role === 'Solo Lectura' && (
                <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2.5 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Bloqueo del Rol: Cambia tu rol a Administrador o Vendedor para registrar órdenes.</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                  1. Oportunidad o Lead Comercial*
                </label>
                <select
                  disabled={role === 'Solo Lectura'}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-slate-900 outline-none rounded-lg focus:border-slate-400 font-semibold"
                  required
                >
                  <option value="">Seleccione un proyecto en negociación...</option>
                  {selectProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.informacion_general_folio} • {p.informacion_general_cliente} ({p.informacion_general_proyecto})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                    Folio Único OC*
                  </label>
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="text"
                    required
                    placeholder="e.g. OC-BIMBO-990-23"
                    value={folioOC}
                    onChange={(e) => setFolioOC(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-[#0b1c30] font-mono outline-none rounded-lg focus:border-slate-400 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                    Fecha de Lanzamiento
                  </label>
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-slate-800 outline-none rounded-lg focus:border-slate-400 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                  Hipervínculo Seguro PDF en Google Drive
                </label>
                <input
                  disabled={role === 'Solo Lectura'}
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={linkOC}
                  onChange={(e) => setLinkOC(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-slate-800 outline-none rounded-lg focus:border-slate-400 font-semibold"
                />
              </div>

              <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl space-y-1">
                <p className="font-bold text-slate-900 font-sans text-xs">Cláusulas de Cumplimiento Logístico:</p>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="checkbox"
                    checked={instalacionIncluida}
                    onChange={(e) => setInstalacionIncluida(e.target.checked)}
                    className="rounded text-[#004ddf] focus:ring-0 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Incluir servicios de instalación física y calibración en planta</span>
                </label>
              </div>

              {/* Actions Footer */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    if (clearPrefilledLead) clearPrefilledLead();
                  }}
                  className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={role === 'Solo Lectura'}
                  className={`w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
                >
                  VINCULAR Y CERRAR NEGOCIO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         MODAL: EDIT DETALLE B2B (EDITING)
         ======================================================== */}
      {editingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <BookOpen className="text-[#004ddf] w-5 h-5 animate-pulse" />
                Editor B2B: {editingPO.folioOC}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPO(null)}
                className="text-slate-300 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleSaveB2B} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                  Estatus de Pago / Comercial
                </label>
                <select
                  value={editingPO.estatusPago || 'Pendiente de cobro'}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setEditingPO(prev => prev ? { 
                      ...prev, 
                      estatusPago: val,
                      replacedById: val === 'Reemplazada' ? prev.replacedById : null
                    } : null);
                  }}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-slate-900 outline-none rounded-lg focus:border-slate-400 font-semibold"
                >
                  <option value="Pendiente de cobro">Pendiente de cobro</option>
                  <option value="Cobrado">Cobrado</option>
                  <option value="Cancelada">Cancelada</option>
                  <option value="Reemplazada">Reemplazada</option>
                  <option value="Activa">Activa</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                  Contacto Planta Vinculado
                </label>
                <select
                  value={editingPO.leadId || ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setEditingPO(prev => prev ? { ...prev, leadId: val } : null);
                  }}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 text-slate-900 outline-none rounded-lg focus:border-slate-400"
                >
                  <option value="">Ninguno seleccionado</option>
                  {contacts.map(con => (
                    <option key={con.id} value={con.id}>
                      {con.nombre} • {con.empresa || con.cliente} ({con.puesto || 'Contacto'})
                    </option>
                  ))}
                </select>
              </div>

              {editingPO.estatusPago === 'Reemplazada' && (
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl space-y-2">
                  <label className="block text-[10px] font-bold text-blue-955 uppercase tracking-wider">
                    Orden que la reemplaza* (Obligatorio)
                  </label>
                  <select
                    required
                    value={editingPO.replacedById || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      setEditingPO(prev => prev ? { ...prev, replacedById: val } : null);
                    }}
                    className="text-xs w-full bg-white border border-blue-300 p-2.5 text-slate-900 outline-none rounded-lg font-semibold focus:border-blue-500"
                  >
                    <option value="">Elija la orden de reemplazo...</option>
                    {purchaseOrders
                      .filter(po => String(po.id) !== String(editingPO.id))
                      .map(po => {
                        const poNumId = getNumericId(po.id);
                        return (
                          <option key={po.id} value={poNumId}>
                            {po.folioOC} • {po.cliente} ({po.proyecto})
                          </option>
                        );
                      })
                    }
                  </select>
                  <p className="text-[9px] text-blue-700 italic">
                    Para evitar estados huérfanos, la regla de negocio exige asociar una orden destino.
                  </p>
                </div>
              )}

              {/* Partidas Breakdown Editor */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-[10px] uppercase tracking-wide">
                    Desglose de Partidas ({editingPO.__partidas?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newItem = { descripcion: '', cantidad: 1, precio_unitario: 0 };
                      setEditingPO(prev => {
                        if (!prev) return null;
                        const items = Array.isArray(prev.__partidas) ? [...prev.__partidas] : [];
                        return { ...prev, __partidas: [...items, newItem] };
                      });
                    }}
                    className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-md border border-slate-200 uppercase transition-colors cursor-pointer"
                  >
                    + Fila
                  </button>
                </div>

                {(!editingPO.__partidas || editingPO.__partidas.length === 0) ? (
                  <div className="p-4 text-center text-slate-400 italic text-[10px]">
                    Sin desglose de partidas. Se conserva el monto cotizado de {editingPO.monto.toLocaleString('en-US', { style: 'currency', currency: editingPO.moneda })}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {editingPO.__partidas.map((item: any, idx: number) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 border border-slate-200 rounded-lg">
                        <input
                          type="text"
                          placeholder="Concepto"
                          value={item.descripcion || ''}
                          onChange={(e) => {
                            const desc = e.target.value;
                            setEditingPO(prev => {
                              if (!prev || !prev.__partidas) return null;
                              const updated = [...prev.__partidas];
                              updated[idx] = { ...updated[idx], descripcion: desc };
                              return { ...prev, __partidas: updated };
                            });
                          }}
                          className="text-[10px] flex-1 border border-slate-200 p-1.5 rounded-lg bg-white outline-none focus:border-slate-400"
                          required
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Cant"
                          value={item.cantidad || ''}
                          onChange={(e) => {
                            const cant = parseInt(e.target.value, 10) || 0;
                            setEditingPO(prev => {
                              if (!prev || !prev.__partidas) return null;
                              const updated = [...prev.__partidas];
                              updated[idx] = { ...updated[idx], cantidad: cant };
                              return { ...prev, __partidas: updated };
                            });
                          }}
                          className="text-[10px] w-14 border border-slate-200 p-1.5 rounded-lg text-center bg-white outline-none focus:border-slate-400"
                          required
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Precio"
                          value={item.precio_unitario || ''}
                          onChange={(e) => {
                            const prec = parseFloat(e.target.value) || 0;
                            setEditingPO(prev => {
                              if (!prev || !prev.__partidas) return null;
                              const updated = [...prev.__partidas];
                              updated[idx] = { ...updated[idx], precio_unitario: prec };
                              return { ...prev, __partidas: updated };
                            });
                          }}
                          className="text-[10px] w-20 border border-slate-200 p-1.5 rounded-lg text-right bg-white outline-none focus:border-slate-400"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPO(prev => {
                              if (!prev || !prev.__partidas) return null;
                              return { ...prev, __partidas: prev.__partidas.filter((_, i) => i !== idx) };
                            });
                          }}
                          className="text-red-500 hover:text-red-700 text-lg font-bold px-1.5"
                          title="Eliminar partida"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editingPO.__partidas && editingPO.__partidas.length > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 pt-2 border-t border-slate-100">
                    <span>Monto recalculado por partidas:</span>
                    <span className="font-mono text-[#004ddf] text-xs">
                      {calculatePOTotal(editingPO).toLocaleString('en-US', {
                        style: 'currency',
                        currency: editingPO.moneda,
                        minimumFractionDigits: 0
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPO(null)}
                  className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="w-full bg-[#004ddf] text-white font-bold py-2.5 rounded-lg hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> GUARDAR B2B
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         B2B PARTIDAS DETAIL DRAWER (SLIDE-OVER)
         ======================================================== */}
      {selectedPOForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden text-left">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSelectedPOForDrawer(null)}
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 ease-out">
              {/* Header */}
              <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shadow-md shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-emerald-400 w-5 h-5" />
                    <h2 className="text-lg font-bold font-sans tracking-tight">Desglose de Partidas • B2B</h2>
                  </div>
                  <p className="text-[11px] text-slate-350 mt-1">
                    Orden de Compra: <span className="font-mono font-bold text-emerald-400">{selectedPOForDrawer.folioOC}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPOForDrawer(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm font-bold shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Header Summary Cards */}
              <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                <div className="bg-white p-3 border border-slate-150 rounded-lg shadow-3xs">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cliente</p>
                  <p className="font-bold text-slate-900 truncate mt-0.5">{selectedPOForDrawer.cliente || 'Sin Cliente'}</p>
                </div>
                <div className="bg-white p-3 border border-slate-150 rounded-lg shadow-3xs">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Proyecto</p>
                  <p className="font-bold text-slate-900 truncate mt-0.5">{selectedPOForDrawer.proyecto || 'Sin Proyecto'}</p>
                </div>
                <div className="bg-white p-3 border border-slate-150 rounded-lg shadow-3xs">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Monto Formal</p>
                  <p className="font-bold text-emerald-600 font-mono text-xs mt-0.5">
                    {calculatePOTotal(selectedPOForDrawer).toLocaleString('en-US', {
                      style: 'currency',
                      currency: selectedPOForDrawer.moneda || 'MXN',
                      minimumFractionDigits: 0
                    })}
                  </p>
                </div>
                <div className="bg-white p-3 border border-slate-150 rounded-lg shadow-3xs">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Estatus Pago</p>
                  <div className="mt-1">
                    {renderEstatusBadge(selectedPOForDrawer.estatusPago || 'Pendiente de cobro')}
                  </div>
                </div>
              </div>

              {/* Partidas List Table */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                  <span>📋 Partidas registradas ({selectedPOForDrawer.__partidas?.length || 0})</span>
                </h4>

                {(!selectedPOForDrawer.__partidas || selectedPOForDrawer.__partidas.length === 0) ? (
                  <div className="p-12 text-center text-slate-400 italic text-xs bg-slate-50 border rounded-xl">
                    No hay desglose de partidas detallado para esta Orden de Compra.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 border-b border-slate-200 text-center w-10">#</th>
                          <th className="py-2.5 px-3 border-b border-slate-200">Clave</th>
                          <th className="py-2.5 px-3 border-b border-slate-200">Descripción / Concepto</th>
                          <th className="py-2.5 px-3 border-b border-slate-200 text-center w-12">UM</th>
                          <th className="py-2.5 px-3 border-b border-slate-200 text-center w-12">Cant</th>
                          <th className="py-2.5 px-3 border-b border-slate-200 text-right">Unitario</th>
                          <th className="py-2.5 px-3 border-b border-slate-200 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                        {selectedPOForDrawer.__partidas.map((item: any, idx: number) => {
                          const lineaNum = item.Numero_Linea || (idx + 1);
                          const desc = item.Descripcion_Articulo || item.descripcion || 'Sin descripción';
                          const clave = item.Clave_Articulo_Proveedor || '-';
                          const unidad = item.Unidad_Medida || 'Pza';
                          const cant = item.Cantidad_Ordenada ?? item.cantidad ?? 0;
                          const precio = item.Precio_Unitario ?? item.precio_unitario ?? 0;
                          const total = item.Importe_Linea ?? (cant * precio);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center border-r bg-slate-50/50 font-mono text-[10px] text-slate-500">{lineaNum}</td>
                              <td className="py-2.5 px-3 font-mono text-[9px] text-slate-500">{clave}</td>
                              <td className="py-2.5 px-3 font-sans text-xs text-slate-800">{desc}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500">{unidad}</td>
                              <td className="py-2.5 px-3 text-center font-mono">{cant}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                                {precio.toLocaleString('en-US', {
                                  style: 'currency',
                                  currency: selectedPOForDrawer.moneda || 'MXN'
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[10px] text-[#004ddf] bg-blue-50/30">
                                {total.toLocaleString('en-US', {
                                  style: 'currency',
                                  currency: selectedPOForDrawer.moneda || 'MXN'
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-500 font-semibold uppercase">
                  Monto Total Consolidado B2B:
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600">
                  {calculatePOTotal(selectedPOForDrawer).toLocaleString('en-US', {
                    style: 'currency',
                    currency: selectedPOForDrawer.moneda || 'MXN'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
