import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  FilterX, 
  Calendar, 
  MapPin, 
  Settings, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  Trophy, 
  Flame, 
  Zap, 
  Snowflake, 
  History, 
  CheckSquare, 
  Check, 
  FileText, 
  Clock,
  MoreVertical,
  Activity,
  RefreshCw
} from 'lucide-react';
import { CRMRecord, UserRole, UserAccount, FollowupEntry } from '../../types';
import { getMexicoCityDateString, getMexicoCityDateTimeShortString } from '../../dateUtils';
import { safeJsonParse, safeRound } from '../../utils/coreUtils';
import { KanbanMeta } from './KanbanBoard';

interface LeadsTableProps {
  records: CRMRecord[];
  role: string;
  dbUsers: UserAccount[];
  exchangeRate: number;
  kanbanMeta: Record<string, KanbanMeta>;
  setKanbanMeta: React.Dispatch<React.SetStateAction<Record<string, KanbanMeta>>>;
  kanbanColumns: string[];
  onUpdateRecord: (record: CRMRecord) => void;
  onDeleteRecord: (id: string) => void;
  setActiveDrawerRecordId: (id: string | null) => void;
  setEditingRecord: (record: CRMRecord) => void;
  setDeleteConfirmId: (id: string | null) => void;
  handleAddNewCard: () => void;
  getDaysInStage: (dateEntered: string) => number;
  getStageStyles: (st: string) => { dot: string; bg: string };
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  onResetStagnation: (record: CRMRecord) => void;
}

export default function LeadsTable({
  records,
  role,
  dbUsers,
  exchangeRate,
  kanbanMeta,
  setKanbanMeta,
  kanbanColumns,
  onUpdateRecord,
  onDeleteRecord,
  setActiveDrawerRecordId,
  setEditingRecord,
  setDeleteConfirmId,
  handleAddNewCard,
  getDaysInStage,
  getStageStyles,
  searchTerm,
  setSearchTerm,
  onResetStagnation
}: LeadsTableProps) {
  
  // Table specific filters, sorting and pagination states
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('folio');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'Todos'>(10);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [activeRowOptionMenu, setActiveRowOptionMenu] = useState<string | null>(null);

  // Advanced filters inputs
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [quarterFilter, setQuarterFilter] = useState<string>('All');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync general search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm, setSearchTerm]);

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Click outside header dropdowns handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  // Extract unique years from records for the year filter dropdown
  const uniqueYears = useMemo(() => {
    const years = records.map((r) => {
      const d = r.fecha_registro;
      if (!d) return '';
      return d.substring(0, 4);
    }).filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
  }, [records]);

  // Master filters processor
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const meta = kanbanMeta[r.id];
      const matchedUser = r.contacto_asignado_id ? dbUsers.find(u => u.id === r.contacto_asignado_id) : null;
      const currentResponsable = matchedUser ? matchedUser.nombre : (meta?.responsable || r.responsable || '');

      // Search bar query mapping
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchesQuery = 
          (r.informacion_general_folio || '').toLowerCase().includes(q) ||
          (r.informacion_general_cliente || '').toLowerCase().includes(q) ||
          (r.informacion_general_proyecto || '').toLowerCase().includes(q) ||
          (r.informacion_general_planta || '').toLowerCase().includes(q) ||
          (currentResponsable || '').toLowerCase().includes(q);
        
        if (!matchesQuery) return false;
      }

      // Tab selector filtering
      if (activeTabFilter === 'active') {
        if (r.estado_proyecto === 'Cerrado Ganado') return false;
      } else if (activeTabFilter === 'closed') {
        if (r.estado_proyecto !== 'Cerrado Ganado') return false;
      }

      // Column filters (Excel style checkboxes)
      for (const colKey of Object.keys(colFilters)) {
        const selectedVals = colFilters[colKey];
        if (selectedVals && selectedVals.length > 0) {
          let rowVal = '';
          if (colKey === 'folio') rowVal = r.informacion_general_folio || '';
          else if (colKey === 'client') rowVal = r.informacion_general_cliente || '';
          else if (colKey === 'plant') rowVal = r.informacion_general_planta || '';
          else if (colKey === 'project') rowVal = r.informacion_general_proyecto || '';
          else if (colKey === 'stage') rowVal = meta?.stage || r.etapa || 'Nuevo';
          else if (colKey === 'responsable') rowVal = currentResponsable || '';
          else if (colKey === 'status') rowVal = r.estado_proyecto || 'null';
          else if (colKey === 'level') rowVal = r.status_proyecto || 'null';

          if (!selectedVals.includes(rowVal)) {
            return false;
          }
        }
      }

      // Advanced filters - Year
      if (yearFilter !== 'All') {
        if (!r.fecha_registro || !r.fecha_registro.startsWith(yearFilter)) {
          return false;
        }
      }

      // Advanced filters - Quarter
      if (quarterFilter !== 'All' && r.fecha_registro) {
        const month = parseInt(r.fecha_registro.substring(5, 7), 10);
        if (isNaN(month)) return false;
        if (quarterFilter === 'Q1' && (month < 1 || month > 3)) return false;
        if (quarterFilter === 'Q2' && (month < 4 || month > 6)) return false;
        if (quarterFilter === 'Q3' && (month < 7 || month > 9)) return false;
        if (quarterFilter === 'Q4' && (month < 10 || month > 12)) return false;
      }

      // Advanced filters - Region Geographic matching
      if (regionFilter !== 'All') {
        const clientRegion = (r.cliente_ubicacion || '').toLowerCase();
        const selectedReg = regionFilter.toLowerCase();
        
        if (selectedReg === 'centro') {
          if (!clientRegion.includes('centro') && !clientRegion.includes('cdmx') && !clientRegion.includes('edomex') && !clientRegion.includes('mexico')) return false;
        } else if (selectedReg === 'occidente') {
          if (!clientRegion.includes('occidente') && !clientRegion.includes('jalisco') && !clientRegion.includes('gdl') && !clientRegion.includes('guadalajara')) return false;
        } else if (selectedReg === 'bajío') {
          if (!clientRegion.includes('bajio') && !clientRegion.includes('silao') && !clientRegion.includes('gto') && !clientRegion.includes('guanajuato') && !clientRegion.includes('qro') && !clientRegion.includes('queretaro')) return false;
        } else if (selectedReg === 'norte') {
          if (!clientRegion.includes('norte') && !clientRegion.includes('mty') && !clientRegion.includes('monterrey') && !clientRegion.includes('nl') && !clientRegion.includes('zacatecas') && !clientRegion.includes('chihuahua') && !clientRegion.includes('coahuila')) return false;
        } else if (selectedReg === 'ee.uu.') {
          if (!clientRegion.includes('usa') && !clientRegion.includes('eeuu') && !clientRegion.includes('united') && !clientRegion.includes('texas') && !clientRegion.includes('america')) return false;
        } else if (selectedReg === 'latam') {
          if (!clientRegion.includes('latam') && !clientRegion.includes('colombia') && !clientRegion.includes('peru') && !clientRegion.includes('chile') && !clientRegion.includes('argentina') && !clientRegion.includes('brasil')) return false;
        } else {
          // 'Otro'
          const standardRegions = ['centro', 'occidente', 'bajio', 'norte', 'usa', 'eeuu', 'united', 'latam', 'colombia', 'peru', 'chile', 'mexico', 'gto', 'jalisco', 'cdmx'];
          const matchedStandard = standardRegions.some(sr => clientRegion.includes(sr));
          if (matchedStandard) return false;
        }
      }

      // Advanced filters - Specific Date Range picker
      if (startDateFilter !== '') {
        const dReg = r.fecha_registro || '';
        if (dReg < startDateFilter) return false;
      }
      if (endDateFilter !== '') {
        const dReg = r.fecha_registro || '';
        if (dReg > endDateFilter) return false;
      }

      return true;
    });
  }, [records, kanbanMeta, dbUsers, searchTerm, colFilters, activeTabFilter, yearFilter, quarterFilter, regionFilter, startDateFilter, endDateFilter]);

  // Sorter
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortColumn === 'folio') {
        valA = a.informacion_general_folio || '';
        valB = b.informacion_general_folio || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'client') {
        valA = a.informacion_general_cliente || '';
        valB = b.informacion_general_cliente || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'plant') {
        valA = a.informacion_general_planta || '';
        valB = b.informacion_general_planta || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'project') {
        valA = a.informacion_general_proyecto || '';
        valB = b.informacion_general_proyecto || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'amount') {
        valA = a.total_subtotal_cotizacion || 0;
        valB = b.total_subtotal_cotizacion || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (sortColumn === 'stage') {
        valA = kanbanMeta[a.id]?.stage || a.etapa || 'Nuevo';
        valB = kanbanMeta[b.id]?.stage || b.etapa || 'Nuevo';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'responsable') {
        const mA = kanbanMeta[a.id];
        const uA = a.contacto_asignado_id ? dbUsers.find(u => u.id === a.contacto_asignado_id) : null;
        valA = uA ? uA.nombre : (mA?.responsable || a.responsable || '');

        const mB = kanbanMeta[b.id];
        const uB = b.contacto_asignado_id ? dbUsers.find(u => u.id === b.contacto_asignado_id) : null;
        valB = uB ? uB.nombre : (mB?.responsable || b.responsable || '');

        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'status') {
        valA = a.estado_proyecto || '';
        valB = b.estado_proyecto || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortColumn === 'level') {
        valA = a.status_proyecto || '';
        valB = b.status_proyecto || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        // Default stable ordering
        valA = a.fecha_registro || '';
        valB = b.fecha_registro || '';
        return sortDirection === 'asc'
          ? (valA > valB ? 1 : valA < valB ? -1 : 0)
          : (valB > valA ? 1 : valB < valA ? -1 : 0);
      }
    });
  }, [filteredRecords, sortColumn, sortDirection, kanbanMeta, dbUsers]);

  // Paginator
  const paginatedRecords = useMemo(() => {
    return pageSize === 'Todos'
      ? sortedRecords
      : sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedRecords, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === 'Todos') return 1;
    return Math.ceil(sortedRecords.length / pageSize) || 1;
  }, [sortedRecords, pageSize]);

  // Reset pagination when page size or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, colFilters, yearFilter, quarterFilter, regionFilter, startDateFilter, endDateFilter, searchTerm, activeTabFilter]);

  // Lock precise column widths
  const getColWidthClass = (colKey: string) => {
    if (colKey === 'folio') return 'min-w-[100px]';
    if (colKey === 'client') return 'min-w-[200px] max-w-[300px]';
    if (colKey === 'plant') return 'min-w-[150px]';
    if (colKey === 'project') return 'min-w-[300px] max-w-[450px]';
    if (colKey === 'amount') return 'min-w-[140px]';
    if (colKey === 'stage') return 'min-w-[140px]';
    if (colKey === 'responsable') return 'min-w-[140px]';
    if (colKey === 'status') return 'min-w-[140px]';
    if (colKey === 'level') return 'min-w-[120px]';
    if (colKey === 'actions_followup') return 'min-w-[140px]';
    if (colKey === 'actions_history') return 'min-w-[160px]';
    if (colKey === 'checklist_progress') return 'min-w-[140px]';
    return '';
  };

  const handleHeaderClick = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  const toggleDropdown = (colKey: string) => {
    setActiveDropdown(activeDropdown === colKey ? null : colKey);
  };

  // Excel style column filter handlers
  const handleCheckboxChange = (colKey: string, val: string) => {
    const current = colFilters[colKey] || [];
    let next: string[];
    if (current.includes(val)) {
      next = current.filter(item => item !== val);
    } else {
      next = [...current, val];
    }
    setColFilters({
      ...colFilters,
      [colKey]: next
    });
  };

  const clearColFilter = (colKey: string) => {
    const updated = { ...colFilters };
    delete updated[colKey];
    setColFilters(updated);
  };

  const getUniqueValuesForCol = (colKey: string) => {
    const vals = records.map(r => {
      const meta = kanbanMeta[r.id];
      const matchedUser = r.contacto_asignado_id ? dbUsers.find(u => u.id === r.contacto_asignado_id) : null;
      const currentResponsable = matchedUser ? matchedUser.nombre : (meta?.responsable || r.responsable || '');

      if (colKey === 'folio') return r.informacion_general_folio || '';
      if (colKey === 'client') return r.informacion_general_cliente || '';
      if (colKey === 'plant') return r.informacion_general_planta || '';
      if (colKey === 'project') return r.informacion_general_proyecto || '';
      if (colKey === 'stage') return meta?.stage || r.etapa || 'Nuevo';
      if (colKey === 'responsable') return currentResponsable || '';
      if (colKey === 'status') return r.estado_proyecto || 'null';
      if (colKey === 'level') return r.status_proyecto || 'null';
      return '';
    }).filter(Boolean);
    return Array.from(new Set(vals)).sort() as string[];
  };

  // Render Header Cell helper with integrated search + excel checkboxes
  const renderHeaderCell = (colKey: string, label: string, alignment?: 'right' | 'center') => {
    const isFiltered = colFilters[colKey] && colFilters[colKey].length > 0;
    const isSorted = sortColumn === colKey;
    const wClass = getColWidthClass(colKey);
    const uniqueVals = getUniqueValuesForCol(colKey);
    
    return (
      <th className={`p-2.5 px-3 font-bold relative group/head ${wClass} ${
        alignment === 'right' ? 'text-right' : alignment === 'center' ? 'text-center' : 'text-left'
      }`} ref={activeDropdown === colKey ? dropdownRef : undefined}>
        <div className={`flex items-center gap-1 w-full ${
          alignment === 'right' ? 'justify-end' : alignment === 'center' ? 'justify-center' : 'justify-between'
        }`}>
          <button
            type="button"
            onClick={() => handleHeaderClick(colKey)} 
            className="hover:text-slate-850 transition-colors flex items-center gap-1 font-bold outline-none py-1.5 leading-none text-left cursor-pointer"
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
              className={`p-1 rounded hover:bg-slate-200 transition-colors outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer ${
                isFiltered 
                  ? 'text-blue-700 bg-blue-100 border border-blue-200 shadow-3xs hover:bg-blue-150' 
                  : 'text-slate-400 opacity-60 group-hover/head:opacity-100'
              }`}
              title="Filtros avanzados"
            >
              <Filter className="w-3 h-3 stroke-[2]" />
            </button>
            
            {activeDropdown === colKey && (
              <div 
                className="absolute top-full mt-1.5 w-60 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 text-left p-3.5 text-xs normal-case font-sans font-normal text-slate-800 animate-in fade-in slide-in-from-top-1.5 duration-150 select-none"
                onClick={(e) => e.stopPropagation()}
                style={{
                  right: alignment === 'right' || colKey === 'level' ? 0 : 'auto',
                  left: alignment === 'right' || colKey === 'level' ? 'auto' : -4,
                }}
              >
                <div className="pb-2 border-b border-slate-150 flex items-center justify-between font-bold text-slate-900 text-[11px] tracking-wide">
                  <span className="uppercase text-slate-500 text-[10px]">Filtrar {label}</span>
                  <button 
                    type="button" 
                    onClick={() => setActiveDropdown(null)} 
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="py-2 space-y-1 border-b border-slate-150">
                  <button
                    type="button"
                    onClick={() => {
                      setSortColumn(colKey);
                      setSortDirection('asc');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    Ascendente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortColumn(colKey);
                      setSortDirection('desc');
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    Descendente
                  </button>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between font-bold text-[9px] text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                    <span>Valores</span>
                    {isFiltered && (
                      <button 
                        type="button" 
                        onClick={() => clearColFilter(colKey)} 
                        className="text-blue-600 hover:text-blue-800 font-extrabold normal-case text-[10px] cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 bg-slate-50/50 rounded-lg border border-slate-150">
                    {uniqueVals.length === 0 ? (
                      <div className="p-2 text-center text-slate-400 italic">No hay datos</div>
                    ) : (
                      uniqueVals.map(val => {
                        const checked = (colFilters[colKey] || []).includes(val);
                        return (
                          <label key={val} className="flex items-center gap-2 px-1.5 py-0.5 hover:bg-slate-100 rounded transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleCheckboxChange(colKey, val)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="truncate max-w-[170px] text-slate-700 font-semibold text-[11px] font-mono leading-none">
                              {val === 'null' ? <span className="text-slate-400 italic">null</span> : val}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4 fade-in select-text">
      
      {/* QUICK TABS PILLS FOR PIPELINE STATE */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex bg-slate-200/60 rounded-lg p-1 border border-slate-200">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTabFilter === 'all'
                ? 'bg-white shadow-3xs text-blue-700 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({records.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('active')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTabFilter === 'active'
                ? 'bg-white shadow-3xs text-blue-700 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔥 Activos ({records.filter(r => r.estado_proyecto !== 'Cerrado Ganado').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('closed')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
              setLocalSearchTerm('');
              setColFilters({});
              setActiveTabFilter('all');
              setYearFilter('All');
              setQuarterFilter('All');
              setRegionFilter('All');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer"
            title="Limpiar todos los filtros"
          >
            <FilterX className="w-3.5 h-3.5 text-slate-500" />
            Reestablecer Filtros
          </button>

          <button
            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
      {isAdvancedFiltersOpen && (
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-3xs animate-in fade-in slide-in-from-top-2 duration-200 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
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

      {/* Main CRM records table inside elevated paper card */}
      <div className="relative bg-slate-100/40 p-4 rounded-xl border border-slate-200 shadow-[inset_0_2px_4px_rgba(15,23,42,0.05)] mb-6">
        <div className="bg-white border-t border-l border-slate-200 border-r-2 border-b-6 border-b-[#c3cbd5] border-r-[#e2e8f0] rounded-xl shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] overflow-hidden">
          
          {/* SEARCH & RECORDS COUNTER PANEL */}
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
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
            <table className="w-full text-left border-collapse table-auto whitespace-nowrap">
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
                  <th className="p-3 px-4 font-bold text-right text-slate-500 min-w-[150px]">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-sm select-text">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400">
                      Ningún registro mapea con los filtros definidos.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => {
                    const matchedUser = r.contacto_asignado_id ? dbUsers.find(u => u.id === r.contacto_asignado_id) : null;
                    const meta = kanbanMeta[r.id];
                    const currentResponsable = matchedUser ? matchedUser.nombre : (meta?.responsable || r.responsable || null);

                    return (
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
                            const metaData = kanbanMeta[r.id];
                            const tags = (metaData && metaData.tags) 
                              ? (Array.isArray(metaData.tags) ? metaData.tags : String(metaData.tags).split(',').filter(Boolean))
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
                            currency: r.informacion_general_moneda || 'USD',
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
                            getStageStyles={getStageStyles}
                          />
                        </td>
                        <td className={`p-3 px-4 text-center ${getColWidthClass('responsable')}`}>
                          <ResponsableCell
                            record={r}
                            role={role}
                            dbUsers={dbUsers}
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
                            currentTemp={r.status_proyecto as any}
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
                        
                        {/* Options button */}
                        <td className="p-3 px-4 text-right min-w-[150px] relative">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.informacion_general_link_cotizacion && r.informacion_general_link_cotizacion !== 'N/A' && r.informacion_general_link_cotizacion.trim().startsWith('http') && (
                              <a 
                                href={r.informacion_general_link_cotizacion.trim()} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                                title="Ver Cotización (PDF)"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {role !== 'Solo Lectura' && (
                              <button
                                onClick={() => {
                                  onResetStagnation(r);
                                }}
                                className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Reiniciar estancamiento a 0 días"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setActiveDrawerRecordId(r.id);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title="Detalles y comentarios"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setActiveRowOptionMenu(activeRowOptionMenu === r.id ? null : r.id);
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              
                              {activeRowOptionMenu === r.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40 bg-transparent" 
                                    onClick={() => setActiveRowOptionMenu(null)}
                                  />
                                  <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                                    <button
                                      type="button"
                                      disabled={role === 'Solo Lectura'}
                                      onClick={() => {
                                        setActiveRowOptionMenu(null);
                                        setEditingRecord(r);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3 text-slate-400" />
                                      Modificar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={role === 'Solo Lectura'}
                                      onClick={() => {
                                        setActiveRowOptionMenu(null);
                                        setDeleteConfirmId(r.id);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-650 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      Eliminar
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE PAGINATION FOOTER */}
          {pageSize !== 'Todos' && totalPages > 1 && (
            <div className="bg-[#f8fafc] border-t border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Página <span className="text-slate-800">{currentPage}</span> de <span className="text-slate-800">{totalPages}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ======================== HELPER CELL COMPONENTS ========================

function EtapaCell({
  record,
  role,
  kanbanColumns,
  kanbanMeta,
  setKanbanMeta,
  onUpdateRecord,
  getStageStyles
}: {
  record: CRMRecord;
  role: string;
  kanbanColumns: string[];
  kanbanMeta: Record<string, any>;
  setKanbanMeta: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onUpdateRecord: (rec: CRMRecord) => void;
  getStageStyles: (st: string) => { dot: string; bg: string };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
                className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${
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
  dbUsers,
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100 select-none">
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
                className={`w-full text-left px-2 py-1 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${
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
              className="w-full text-left px-2 py-1 text-xs font-semibold rounded hover:bg-red-50 text-red-600 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span className="italic">Desasignar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        <div className="absolute left-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100 select-none">
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
                className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer ${
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-28 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100 select-none">
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
                className={`w-full flex items-center justify-center py-1 px-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer ${
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
        className="w-full text-center text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none text-slate-700 font-semibold"
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
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
        <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 text-left animate-in fade-in duration-150 select-none">
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
