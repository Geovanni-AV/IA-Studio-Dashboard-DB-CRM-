import React, { useState, useEffect } from 'react';
import { CRMRecord, UserRole, FollowupEntry } from '../types';
import { getMexicoCityDateString, getMexicoCityDateTimeShortString } from '../dateUtils';
import { toValidUUID } from '../supabaseService';
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
  const [formHardware, setFormHardware] = useState<number>(0);
  const [formServicios, setFormServicios] = useState<number>(0);
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; folio: string } | null>(null);
  const [pdfPromptOpen, setPdfPromptOpen] = useState(false);
  const [pdfPromptRecord, setPdfPromptRecord] = useState<CRMRecord | null>(null);
  
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
  }, [searchTerm, activeTabFilter, yearFilter, quarterFilter, regionFilter, startDateFilter, endDateFilter, colFilters]);

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
    setFormStatus(null);
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
    setFormFolio(rec.informacion_general_folio || '');
    setFormCliente(rec.informacion_general_cliente || '');
    setFormPlanta(rec.informacion_general_planta || '');
    setFormPais(rec.cliente_pais || 'México');
    setFormUbicacion(rec.cliente_ubicacion || '');
    setFormProyecto(rec.informacion_general_proyecto || '');
    setFormLinkCotizacion(rec.informacion_general_link_cotizacion || '');
    setFormHardware(rec.total_hardware_cotizacion);
    setFormServicios(rec.total_servicios_cotizacion);
    setFormMoneda(rec.informacion_general_moneda);
    setFormStatus(rec.estado_proyecto || null);
    setFormNotas(rec.notas_comerciales || '');
    setFormSustituye(rec.sustituye_folio_anterior || '');
    setIsFormOpen(true);
  };

  // Delete Action triggered by clicking the trash button
  const handleDelete = (id: string, folio: string) => {
    if (role !== 'Admin') {
      alert(`🔒 Acción Bloqueada: El rol actual "${role}" no tiene privilegios para eliminar folios definitivos.`);
      return;
    }
    setRecordToDelete({ id, folio });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteActual = () => {
    if (recordToDelete) {
      const fullRecord = records.find(r => r.id === recordToDelete.id);
      const extraInfo = fullRecord 
        ? ` (${fullRecord.informacion_general_cliente || 'N/A'} - ${fullRecord.informacion_general_proyecto || 'N/A'})` 
        : '';
      onDeleteRecord(recordToDelete.id);
      onShowAudit('ELIMINACIÓN', `Eliminó registro comercial con Folio ${recordToDelete.folio}${extraInfo} permanentemente.`);
      setDeleteConfirmOpen(false);
      setRecordToDelete(null);
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
      total_hardware_cotizacion: Number(formHardware),
      total_servicios_cotizacion: Number(formServicios),
      total_subtotal_cotizacion: subtotal,
      total_iva_cotizacion: iva,
      total_general_cotizacion: total,
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
      informacion_general_instalacion_incluida: existingRec?.informacion_general_instalacion_incluida ?? undefined
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
      valueUSD = r.total_general_cotizacion / 17.05; // Standard B2B Exchange Rate from App.tsx
    }
    if (valueUSD < 15000) return 'low';
    if (valueUSD >= 15000 && valueUSD <= 50000) return 'medium';
    return 'high';
  };

  // Extract unique filter lists
  const uniqueClients = Array.from(new Set(records.map((r) => r.informacion_general_cliente).filter((c): c is string => !!c)));
  const uniquePlants = Array.from(new Set(records.map((r) => r.informacion_general_planta).filter((p): p is string => !!p)));

  // Extract dynamic unique years list from records
  const uniqueYears = Array.from(
    new Set(
      records
        .map((r) => (r.fecha_registro ? r.fecha_registro.substring(0, 4) : ''))
        .filter(Boolean)
    )
  ).sort();

  // Base filtration matching original top-bar custom selectors
  const baseFiltered = records.filter((r) => {
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

  // Apply Excel dynamic column filters
  const filteredRecords = baseFiltered.filter((r) => {
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
      else if (colKey === 'status') val = r.estado_proyecto;
      else if (colKey === 'level') val = getTemperature(r);
      else if (colKey === 'actions_followup') val = r.acciones_seguimiento?.[0]?.notas;
      else if (colKey === 'oc') val = r.link_orden_compra;

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
      else if (colKey === 'status') val = r.estado_proyecto;
      else if (colKey === 'level') val = getTemperature(r);
      else if (colKey === 'actions_followup') val = r.acciones_seguimiento?.[0]?.notas;
      else if (colKey === 'oc') val = r.link_orden_compra;

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
  const sortedRecords = [...filteredRecords].sort((a, b) => {
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
          val = rec.total_general_cotizacion / 17.05;
        }
        return val;
      };
      valA = getUSD(a);
      valB = getUSD(b);
    } else if (sortColumn === 'status') {
      valA = a.estado_proyecto || '';
      valB = b.estado_proyecto || '';
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
    } else if (sortColumn === 'oc') {
      valA = a.link_orden_compra || '';
      valB = b.link_orden_compra || '';
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

  const paginatedRecords = pageSize === 'Todos'
    ? sortedRecords
    : sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calculate dynamic summary stats for search matching
  const totalCotizacionesUSD = filteredRecords.reduce((acc, r) => {
    let val = r.total_general_cotizacion;
    if (r.informacion_general_moneda === 'MXN') {
      val = r.total_general_cotizacion / 17.05;
    }
    return acc + val;
  }, 0);

  const totalActivoUSD = filteredRecords
    .filter((r) => r.estado_proyecto !== 'Cerrado Ganado')
    .reduce((acc, r) => {
      let val = r.total_general_cotizacion;
      if (r.informacion_general_moneda === 'MXN') {
        val = r.total_general_cotizacion / 17.05;
      }
      return acc + val;
    }, 0);

  const averageQuotaUSD = filteredRecords.length > 0 ? (totalCotizacionesUSD / filteredRecords.length) : 0;

  // helper to lock precise column widths across headers & row metrics
  const getColWidthClass = (colKey: string) => {
    if (colKey === 'folio') return 'w-[8%] min-w-[85px] max-w-[95px]';
    if (colKey === 'client') return 'w-[12%] min-w-[110px] max-w-[130px]';
    if (colKey === 'plant') return 'w-[12%] min-w-[110px] max-w-[130px]';
    if (colKey === 'project') return 'w-[15%] min-w-[140px] max-w-[190px]';
    if (colKey === 'amount') return 'w-[10%] min-w-[95px] max-w-[110px]';
    if (colKey === 'status') return 'w-[9%] min-w-[100px] max-w-[115px]';
    if (colKey === 'level') return 'w-[8%] min-w-[95px] max-w-[110px]';
    if (colKey === 'actions_followup') return 'w-[15%] min-w-[140px] max-w-[185px]';
    if (colKey === 'oc') return 'w-[11%] min-w-[115px] max-w-[145px]';
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por folio, cliente, planta o descripción..."
                className="text-xs w-full bg-white border border-slate-250 py-2 pl-9 pr-8 rounded-lg hover:border-slate-350 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-3xs font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
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
                  {renderHeaderCell('amount', 'Cotización Total', 'right')}
                  {renderHeaderCell('status', 'Estado')}
                  {renderHeaderCell('level', 'Nivel / Termo', 'center')}
                  {renderHeaderCell('actions_followup', 'Acciones', 'center')}
                  {renderHeaderCell('oc', 'Ref OC / Trámite', 'center')}
                  <th className="p-3 px-4 font-bold text-right text-slate-500 w-[8%] min-w-[100px] max-w-[120px]">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-sm">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
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
                        {r.informacion_general_proyecto || <span className="text-slate-400 font-normal italic">null</span>}
                      </td>
                      <td className={`p-3 px-4 text-right font-bold text-slate-900 font-data-mono truncate ${getColWidthClass('amount')}`}>
                        {r.total_general_cotizacion.toLocaleString('en-US', {
                          style: 'currency',
                          currency: r.informacion_general_moneda,
                          minimumFractionDigits: 0
                        })}
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
                        <AccionesSeguimientoCell
                          record={r}
                          role={role}
                          onUpdate={onUpdateRecord}
                        />
                      </td>
                      <td className={`p-3 px-4 text-center ${getColWidthClass('oc')}`}>
                        <TrazabilidadCell
                          record={r}
                          role={role}
                          onUpdate={onUpdateRecord}
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
        </div>
      )}

      {/* MODAL: EXPLICIT 3D REMOVAL ALERT CONFIRMATION */}
      {deleteConfirmOpen && recordToDelete && (
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border-t border-l border-slate-100 border-r-2 border-b-6 border-b-red-500 border-r-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150">
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
              Estás a punto de eliminar definitivamente el expediente comercial con Folio <strong className="font-bold text-red-600 font-data-mono">{recordToDelete.folio}</strong> de la base de datos de Supabase / Google Sheets. 
              <span className="block mt-2 font-bold text-slate-800">
                ⚠ Esta acción eliminará permanentemente la información, cotizaciones asociadas y el historial de trazabilidad del embudo.
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setRecordToDelete(null);
                }}
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
        </div>
      )}

      {/* MODAL: PDF MISSING WARNING & HELP OPTIONS */}
      {pdfPromptOpen && pdfPromptRecord && (
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border-t border-l border-slate-100 border-r-2 border-b-6 border-b-[#004ddf]/30 border-r-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
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
      status_proyecto: nextStatusProyecto
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
