import React, { useState, useEffect } from 'react';
import { CRMRecord, UserRole } from '../types';
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
  ExternalLink
} from 'lucide-react';

interface LeadsSectionProps {
  records: CRMRecord[];
  role: UserRole;
  onAddRecord: (record: CRMRecord) => void;
  onUpdateRecord: (record: CRMRecord) => void;
  onDeleteRecord: (id: string) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function LeadsSection({
  records,
  role,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onShowAudit
}: LeadsSectionProps) {
  // Filtering & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [plantFilter, setPlantFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Advanced Filter states
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [pageSize, setPageSize] = useState<number | 'Todos'>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [yearFilter, setYearFilter] = useState('All');
  const [quarterFilter, setQuarterFilter] = useState('All');
  const [temperatureFilter, setTemperatureFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const [amountFilter, setAmountFilter] = useState('All');
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
  const [formHardware, setFormHardware] = useState<number>(0);
  const [formServicios, setFormServicios] = useState<number>(0);
  const [formMoneda, setFormMoneda] = useState<'USD' | 'MXN'>('USD');
  const [formStatus, setFormStatus] = useState<'Propuesta' | 'Negociación' | 'Cerrado Ganado'>('Propuesta');
  const [formNotas, setFormNotas] = useState('');
  const [formSustituye, setFormSustituye] = useState('');
  
  // Real-time calculated values
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);

  // Auto Calculations
  useEffect(() => {
    const calculatedSubtotal = Number(formHardware) + Number(formServicios);
    const calculatedIva = calculatedSubtotal * 0.16;
    const calculatedTotal = calculatedSubtotal + calculatedIva;
    
    setSubtotal(calculatedSubtotal);
    setIva(calculatedIva);
    setTotal(calculatedTotal);
  }, [formHardware, formServicios]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, clientFilter, plantFilter, statusFilter, activeTabFilter, yearFilter, quarterFilter, temperatureFilter, regionFilter, amountFilter, startDateFilter, endDateFilter]);

  // Open Form for creating
  const handleOpenCreateMode = () => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueado el alta de registros.`);
      return;
    }
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
    setFormLinkCotizacion('https://drive.google.com/file/d/new_quote_ref');
    setFormHardware(5000);
    setFormServicios(2000);
    setFormMoneda('USD');
    setFormStatus('Propuesta');
    setFormNotas('');
    setFormSustituye('');
    setIsFormOpen(true);
  };

  // Open Form for editing
  const handleOpenEditMode = (rec: CRMRecord) => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueada la edición.`);
      return;
    }
    setIsEditing(true);
    setFormId(rec.id);
    setFormFolio(rec.informacion_general_folio);
    setFormCliente(rec.informacion_general_cliente);
    setFormPlanta(rec.informacion_general_planta);
    setFormPais(rec.cliente_pais);
    setFormUbicacion(rec.cliente_ubicacion);
    setFormProyecto(rec.informacion_general_proyecto);
    setFormLinkCotizacion(rec.informacion_general_link_cotizacion);
    setFormHardware(rec.total_hardware_cotizacion);
    setFormServicios(rec.total_servicios_cotizacion);
    setFormMoneda(rec.informacion_general_moneda);
    setFormStatus(rec.status_proyecto);
    setFormNotas(rec.notas_comerciales);
    setFormSustituye(rec.sustituye_folio_anterior || '');
    setIsFormOpen(true);
  };

  // Delete Action
  const handleDelete = (id: string, folio: string) => {
    if (role !== 'Admin') {
      alert(`🔒 Acción Bloqueada: El rol actual "${role}" no tiene privilegios para eliminar folios definitivos.`);
      return;
    }
    if (window.confirm(`¿Está seguro de que desea eliminar definitivamente el expediente comercial ${folio}? Esta acción no se puede deshacer.`)) {
      onDeleteRecord(id);
      onShowAudit('ELIMINACIÓN', `Eliminó registro comercial con Folio ${folio}`);
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

    const payload: CRMRecord = {
      id: formId || `rec_${Date.now()}`,
      informacion_general_folio: formFolio,
      fecha_registro: new Date().toISOString().split('T')[0],
      informacion_general_cliente: formCliente,
      informacion_general_planta: formPlanta,
      cliente_pais: formPais,
      cliente_ubicacion: formUbicacion || 'México General',
      informacion_general_proyecto: formProyecto,
      informacion_general_link_cotizacion: formLinkCotizacion,
      total_hardware_cotizacion: Number(formHardware),
      total_servicios_cotizacion: Number(formServicios),
      total_subtotal_cotizacion: subtotal,
      total_iva_cotizacion: iva,
      total_general_cotizacion: total,
      informacion_general_moneda: formMoneda,
      status_proyecto: formStatus,
      notas_comerciales: formNotas,
      acciones_seguimiento: isEditing 
        ? (records.find(r => r.id === formId)?.acciones_seguimiento || []) 
        : [],
      sustituye_folio_anterior: formSustituye || undefined
    };

    if (isEditing) {
      onUpdateRecord(payload);
      onShowAudit('MODIFICACIÓN', `Actualizó expediente comercial de ${formCliente} (Folio ${formFolio})`);
    } else {
      onAddRecord(payload);
      onShowAudit('ALTA REGISTRO', `Creó nueva oferta para ${formCliente} con folio asignado ${formFolio}`);
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
    if (r.prioridad_nivel) return r.prioridad_nivel;
    if (r.status_proyecto === 'Cerrado Ganado') return 'Win';
    
    // Check negotiation
    if (r.status_proyecto === 'Negociación') {
      const isHighValue = r.total_general_cotizacion >= 20000 || (r.informacion_general_moneda === 'MXN' && r.total_general_cotizacion >= 340000);
      const hasManyFollowups = r.acciones_seguimiento && r.acciones_seguimiento.length >= 2;
      return (isHighValue || hasManyFollowups) ? 'Hot' : 'Warm';
    }
    
    // Propuesta
    const hasFollowups = r.acciones_seguimiento && r.acciones_seguimiento.length > 0;
    if (hasFollowups || r.total_general_cotizacion >= 40000) return 'Warm';
    return 'Cool';
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
      valueUSD = r.total_general_cotizacion / 17.05; // Standard B2B Exchange Rate from App.tsx
    }
    if (valueUSD < 15000) return 'low';
    if (valueUSD >= 15000 && valueUSD <= 50000) return 'medium';
    return 'high';
  };

  // Extract unique filter lists
  const uniqueClients = Array.from(new Set(records.map((r) => r.informacion_general_cliente)));
  const uniquePlants = Array.from(new Set(records.map((r) => r.informacion_general_planta)));

  // Extract dynamic unique years list from records
  const uniqueYears = Array.from(
    new Set(
      records
        .map((r) => (r.fecha_registro ? r.fecha_registro.substring(0, 4) : ''))
        .filter(Boolean)
    )
  ).sort();

  // Filter pipeline logic
  const filteredRecords = records.filter((r) => {
    // 1. General search
    const matchesSearch =
      r.informacion_general_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.informacion_general_proyecto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.informacion_general_folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.informacion_general_planta.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Base filters
    const matchesClient = clientFilter === 'All' || r.informacion_general_cliente === clientFilter;
    const matchesPlant = plantFilter === 'All' || r.informacion_general_planta === plantFilter;
    const matchesStatus = statusFilter === 'All' || r.status_proyecto === statusFilter;

    // 3. Tab filter (All, Activos, Cerrados)
    let matchesTab = true;
    if (activeTabFilter === 'active') {
      matchesTab = r.status_proyecto === 'Propuesta' || r.status_proyecto === 'Negociación';
    } else if (activeTabFilter === 'closed') {
      matchesTab = r.status_proyecto === 'Cerrado Ganado';
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

    // 5. Temperature priority
    const recordTemp = getTemperature(r);
    const matchesTemp = temperatureFilter === 'All' || recordTemp === temperatureFilter;

    // 6. Region
    const recordRegion = getRegionGroup(r);
    const matchesRegion = regionFilter === 'All' || recordRegion === regionFilter;

    // 7. Amount range
    const recordAmount = getAmountGroup(r);
    const matchesAmount = amountFilter === 'All' || recordAmount === amountFilter;

    return (
      matchesSearch &&
      matchesClient &&
      matchesPlant &&
      matchesStatus &&
      matchesTab &&
      matchesYear &&
      matchesQuarter &&
      matchesDateRange &&
      matchesTemp &&
      matchesRegion &&
      matchesAmount
    );
  });

  const paginatedRecords = pageSize === 'Todos'
    ? filteredRecords
    : filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calculate dynamic summary stats for search matching
  const totalCotizacionesUSD = filteredRecords.reduce((acc, r) => {
    let val = r.total_general_cotizacion;
    if (r.informacion_general_moneda === 'MXN') {
      val = r.total_general_cotizacion / 17.05;
    }
    return acc + val;
  }, 0);

  const totalActivoUSD = filteredRecords
    .filter((r) => r.status_proyecto !== 'Cerrado Ganado')
    .reduce((acc, r) => {
      let val = r.total_general_cotizacion;
      if (r.informacion_general_moneda === 'MXN') {
        val = r.total_general_cotizacion / 17.05;
      }
      return acc + val;
    }, 0);

  const averageQuotaUSD = filteredRecords.length > 0 ? (totalCotizacionesUSD / filteredRecords.length) : 0;

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
          onClick={handleOpenCreateMode}
          disabled={role === 'Solo Lectura'}
          className={`flex items-center gap-1.5 px-4 font-bold text-xs py-2 bg-blue-600 text-white rounded-md shadow-3xs hover:bg-blue-700 transition-all ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
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
            🔥 Activos ({records.filter(r => r.status_proyecto !== 'Cerrado Ganado').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('closed')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTabFilter === 'closed'
                ? 'bg-white shadow-3xs text-emerald-800 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏆 Cerrados ({records.filter(r => r.status_proyecto === 'Cerrado Ganado').length})
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
              setClientFilter('All');
              setPlantFilter('All');
              setStatusFilter('All');
              setActiveTabFilter('all');
              setYearFilter('All');
              setQuarterFilter('All');
              setTemperatureFilter('All');
              setRegionFilter('All');
              setAmountFilter('All');
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

      {/* FILTER CONTROL BOARD */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-3xs space-y-4">
        {/* Row 1: Primary Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-label-caps">
              Búsqueda General
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. Bimbo, VT-1553, Silao..."
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 pl-8 pr-3 rounded-md hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-label-caps">
              CORPORATIVO B2B
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="All">Todos los Clientes</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-label-caps">
              PLANTA INDUSTRIAL
            </label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="All">Todas las Plantas</option>
              {uniquePlants.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-505 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-label-caps">
              ESTADO PIPELINE
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2.5 rounded-md hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="All">Todos los Estados</option>
              <option value="Propuesta">Propuesta</option>
              <option value="Negociación">Negociación</option>
              <option value="Cerrado Ganado">Cerrado Ganado</option>
            </select>
          </div>
        </div>

        {/* Dynamic & Collapsible Second Row: Advanced Filters */}
        {isAdvancedFiltersOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end animate-fade-in animate-duration-200">
            {/* Year filter requested */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-mono flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Año Registro
              </label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="All">Todos los Años</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Quarter requested (Q1, Q2, Q3...) */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-mono">
                Trimestre (Quarter)
              </label>
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="All">Todos (Quarters)</option>
                <option value="Q1">Q1 (Ene-Mar)</option>
                <option value="Q2">Q2 (Abr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dic)</option>
              </select>
            </div>

            {/* Temperatures: Win, Hot, Warm, Cool requested */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-mono flex items-center gap-1">
                <Flame className="w-3 h-3 text-red-500" />
                Termo / Prioridad
              </label>
              <select
                value={temperatureFilter}
                onChange={(e) => setTemperatureFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="All">Todas las prioridades</option>
                <option value="Win">🏆 Win (Ganados)</option>
                <option value="Hot">🔥 Hot (Negociaciones altas)</option>
                <option value="Warm">⚡ Warm (Activos soporte)</option>
                <option value="Cool">❄️ Cool (Exploratorios)</option>
              </select>
            </div>

            {/* Regions requested */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-mono flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-500" />
                Regiones Geográficas
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
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

            {/* Price threshold ranges */}
            <div>
              <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 px-1 font-mono flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600" />
                Escala de Monto
              </label>
              <select
                value={amountFilter}
                onChange={(e) => setAmountFilter(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 px-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              >
                <option value="All">Todos los montos</option>
                <option value="low">Pequeño (&lt; $15K USD)</option>
                <option value="medium">Mediano ($15k - $50K USD)</option>
                <option value="high">Grande (&gt; $50K USD)</option>
              </select>
            </div>

            {/* Specific Dates ranges */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-slate-400 text-[8px] font-bold uppercase">Desde</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="text-[10px] w-full bg-slate-50 border border-slate-250 p-1.5 focus:ring-1 outline-none text-slate-750 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[8px] font-bold uppercase">Hasta</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="text-[10px] w-full bg-slate-50 border border-slate-250 p-1.5 focus:ring-1 outline-none text-slate-755 font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main CRM records table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8fafc] border-b border-slate-200 text-xs uppercase text-slate-500 font-label-caps">
              <tr>
                <th className="p-3.5 px-4 font-bold">Folio</th>
                <th className="p-3.5 px-4 font-bold">Cliente</th>
                <th className="p-3.5 px-4 font-bold">Planta Industrial</th>
                <th className="p-3.5 px-4 font-bold">Descripción Proyecto</th>
                <th className="p-3.5 px-4 font-bold text-right">Cotización Total</th>
                <th className="p-3.5 px-4 font-bold">Estado</th>
                <th className="p-3.5 px-4 font-bold text-center">Nivel / Termo</th>
                <th className="p-3.5 px-4 font-bold text-center">Trazabilidad OC</th>
                <th className="p-3.5 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedRecords.length === 0 ? (
                <tr>
                   <td colSpan={9} className="p-8 text-center text-slate-400">
                     Ningún registro mapea con los filtros definidos.
                   </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-3 px-4 font-bold font-data-mono text-[#004ddf] text-xs">
                      {r.informacion_general_folio}
                    </td>
                    <td className="p-3 px-4 text-[#0b1c30]">
                      <span className="font-bold">{r.informacion_general_cliente}</span>
                    </td>
                    <td className="p-3 px-4 text-slate-500">
                      {r.informacion_general_planta}
                    </td>
                    <td className="p-3 px-4 text-slate-700 font-medium truncate max-w-[200px]">
                      {r.informacion_general_proyecto}
                    </td>
                    <td className="p-3 px-4 text-right font-bold text-slate-900 font-data-mono">
                      {r.total_general_cotizacion.toLocaleString('en-US', {
                        style: 'currency',
                        currency: r.informacion_general_moneda,
                        minimumFractionDigits: 0
                      })}
                    </td>
                    <td className="p-3 px-4">
                      <span className={`inline-block px-2 text-[10px] font-bold py-0.5 rounded-full border ${
                        r.status_proyecto === 'Cerrado Ganado' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : r.status_proyecto === 'Negociación'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {r.status_proyecto}
                      </span>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <NivelTermoCell
                        record={r}
                        role={role}
                        currentTemp={getTemperature(r)}
                        onUpdate={onUpdateRecord}
                      />
                    </td>
                    <td className="p-3 px-4 text-center">
                      <TrazabilidadCell
                        record={r}
                        role={role}
                        onUpdate={onUpdateRecord}
                      />
                    </td>
                    <td className="p-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(r)}
                          title="Ficha Técnica Completa"
                          className="p-1 px-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditMode(r)}
                          disabled={role === 'Solo Lectura'}
                          className={`p-1 px-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded transition-colors ${role === 'Solo Lectura' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.informacion_general_folio)}
                          disabled={role === 'Solo Lectura' || role === 'Vendedor'}
                          title={role !== 'Admin' ? 'Acción restringida para Admin' : 'Eliminar Folio'}
                          className={`p-1 px-1.5 border border-slate-200 bg-white hover:bg-red-50 text-red-600 rounded transition-colors ${role !== 'Admin' ? 'opacity-40 cursor-not-allowed' : ''}`}
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

      {/* MODAL: DETAIL WINDOW */}
      {isDetailOpen && selectedRecord && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl flex flex-col">
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
        </div>
      )}

      {/* MODAL: INPUT FORM FOR CREATE or UPDATE */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl flex flex-col">
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
                      required
                      min="0"
                      value={formHardware}
                      onChange={(e) => setFormHardware(Number(e.target.value))}
                      className="text-xs w-full bg-white border border-slate-200 p-1.5 focus:ring-1 text-[#0b1c30] font-data-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                      Servicios de Campo (Soporte/Calibración)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formServicios}
                      onChange={(e) => setFormServicios(Number(e.target.value))}
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
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  >
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
        </div>
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

function renderTemperatureBadge(temp: string) {
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

function NivelTermoCell({
  record,
  role,
  currentTemp,
  onUpdate
}: {
  record: CRMRecord;
  role: string;
  currentTemp: string;
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

  const levels: ('Win' | 'Hot' | 'Warm' | 'Cool')[] = ['Win', 'Hot', 'Warm', 'Cool'];

  const handleSelect = (lvl: 'Win' | 'Hot' | 'Warm' | 'Cool') => {
    if (role === 'Solo Lectura') return;
    onUpdate({ ...record, prioridad_nivel: lvl });
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
                key={lvl}
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
