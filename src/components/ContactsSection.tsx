import React, { useState } from 'react';
import { Contact, UserRole } from '../types';
import { Phone, Mail, Award, Search, UserCheck, ShieldAlert, Plus, Grid, Trash2, ChevronDown, ChevronUp, Briefcase, Layers, Tag, MapPin, Globe, Building2, Map, Home, Hash, User } from 'lucide-react';

// Helper function to normalize strings and titles case-insensitively and filter out placeholder values
function toTitleCase(str: any): string {
  if (typeof str !== 'string') {
    if (str && typeof str.toString === 'function') {
      str = str.toString();
    } else {
      return '';
    }
  }
  const val = str.trim();
  if (!val) return '';
  const lowercase = val.toLowerCase();
  // Filter out common placeholders
  if (['n/a', 'na', 'no proporcionado', 'no_proporcionado', 'sin especificar', 'none', 'null', 'undefined', 'general'].includes(lowercase)) {
    return '';
  }
  // Capitalize first letter of each word, keeping Spanish prepositions/conjunctions lowercase
  const minorWords = ['de', 'del', 'la', 'el', 'en', 'o', 'y', 'a', 'por', 'con', 'para', 'las', 'los'];
  return lowercase
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && minorWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

interface ContactsSectionProps {
  contacts: Contact[];
  role: UserRole;
  onAddContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function ContactsSection({
  contacts,
  role,
  onAddContact,
  onDeleteContact,
  onShowAudit
}: ContactsSectionProps) {
  const [search, setSearch] = useState('');
  const [onlyCommercial, setOnlyCommercial] = useState(false);
  
  // 7 core filters requested by user
  const [selectedPuesto, setSelectedPuesto] = useState('All');
  const [selectedEmpresa, setSelectedEmpresa] = useState('All');
  const [selectedTipo, setSelectedTipo] = useState('All');
  const [selectedCliente, setSelectedCliente] = useState('All');
  const [selectedOrganizacion, setSelectedOrganizacion] = useState('All');
  const [selectedPlanta, setSelectedPlanta] = useState('All');
  const [selectedUbicacion, setSelectedUbicacion] = useState('All');

  // New Contact form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [puesto, setPuesto] = useState('');
  const [cliente, setCliente] = useState('');
  const [planta, setPlanta] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [isCommercial, setIsCommercial] = useState(false);

  // Expanded fields to match table structure
  const [tipo, setTipo] = useState('');
  const [organizacion, setOrganizacion] = useState('');
  const [prefijoSufijo, setPrefijoSufijo] = useState('');
  const [pais, setPais] = useState('');
  const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [nombreUbicacion, setNombreUbicacion] = useState('');
  const [empresa, setEmpresa] = useState('');

  // Expandable card state for full database details integration
  const [expandedContactIds, setExpandedContactIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedContactIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Reset helper
  const clearAllFilters = () => {
    setSearch('');
    setSelectedPuesto('All');
    setSelectedEmpresa('All');
    setSelectedTipo('All');
    setSelectedCliente('All');
    setSelectedOrganizacion('All');
    setSelectedPlanta('All');
    setSelectedUbicacion('All');
    setOnlyCommercial(false);
  };

  // Submit Contact
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para registrar contactos.`);
      return;
    }
    if (!name || !puesto || !cliente || !planta) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    const nContact: Contact = {
      id: `con_${Date.now()}`,
      nombre: name,
      puesto,
      cliente,
      planta,
      email,
      telefono: telefono || 'N/A',
      esEnlaceComercial: isCommercial,
      tipo,
      organizacion,
      prefijoSufijo,
      pais,
      estado,
      ciudad,
      direccion,
      nombreUbicacion,
      empresa: empresa || cliente // Empresa defaults to cliente if left empty
    };

    onAddContact(nContact);
    onShowAudit('ALTA REGISTRO', `Registró nuevo contacto técnico: ${name} en ${cliente} (${planta || 'Sin especificar'}). Puesto: "${puesto}", Correo: ${email}, Teléfono: ${telefono || 'N/A'}, Link Comercial: ${isCommercial ? 'SÍ' : 'NO'}`);

    // Reset Form
    setName('');
    setPuesto('');
    setCliente('');
    setPlanta('');
    setEmail('');
    setTelefono('');
    setIsCommercial(false);
    setTipo('');
    setOrganizacion('');
    setPrefijoSufijo('');
    setPais('');
    setEstado('');
    setCiudad('');
    setDireccion('');
    setNombreUbicacion('');
    setEmpresa('');
    setIsFormOpen(false);
  };

  // Delete Contact
  const handleDelete = (id: string, contactName: string) => {
    if (role !== 'Admin') {
      alert(`🔒 Acción restringida: Solo el rol de Administrador puede remover ingenieros del directorio central.`);
      return;
    }
    const targetContact = contacts.find(c => c.id === id);
    const companyInfo = targetContact ? ` de la empresa ${targetContact.cliente}` : '';
    if (window.confirm(`¿Está seguro de que desea eliminar el contacto "${contactName}" del directorio?`)) {
      onDeleteContact(id);
      onShowAudit('ELIMINACIÓN', `Removió contacto técnico "${contactName}"${companyInfo} del directorio`);
    }
  };

  // Extract unique values for filtering dropdowns (ignoring empty/falsy/placeholders, normalized to Title Case and sorted)
  const uniquePuestos = Array.from(new Set(contacts.map((c) => toTitleCase(c.puesto)).filter(Boolean))).sort();
  const uniqueEmpresas = Array.from(new Set(contacts.map((c) => toTitleCase(c.empresa || c.cliente)).filter(Boolean))).sort();
  const uniqueTipos = Array.from(new Set(contacts.map((c) => toTitleCase(c.tipo)).filter(Boolean))).sort();
  const uniqueClientes = Array.from(new Set(contacts.map((c) => toTitleCase(c.cliente)).filter(Boolean))).sort();
  const uniqueOrganizaciones = Array.from(new Set(contacts.map((c) => toTitleCase(c.organizacion)).filter(Boolean))).sort();
  const uniquePlantas = Array.from(new Set(contacts.map((c) => toTitleCase(c.planta)).filter(Boolean))).sort();
  
  // Extract unique location names, cities, states, and countries (normalized to Title Case)
  const uniqueUbicaciones = Array.from(new Set(
    contacts.flatMap((c) => [
      toTitleCase(c.nombreUbicacion),
      toTitleCase(c.ciudad),
      toTitleCase(c.estado),
      toTitleCase(c.pais)
    ]).filter(Boolean)
  )).sort();

  // Filter directory
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.puesto || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.cliente || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.tipo || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.organizacion || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.planta || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.empresa || '').toLowerCase().includes(search.toLowerCase());

    const matchesPuesto = selectedPuesto === 'All' || toTitleCase(c.puesto) === selectedPuesto;
    
    const matchesEmpresa =
      selectedEmpresa === 'All' ||
      toTitleCase(c.empresa || c.cliente) === selectedEmpresa;
      
    const matchesTipo = selectedTipo === 'All' || toTitleCase(c.tipo) === selectedTipo;
    const matchesClient = selectedCliente === 'All' || toTitleCase(c.cliente) === selectedCliente;
    const matchesOrganizacion = selectedOrganizacion === 'All' || toTitleCase(c.organizacion) === selectedOrganizacion;
    const matchesPlanta = selectedPlanta === 'All' || toTitleCase(c.planta) === selectedPlanta;
    
    const matchesUbicacion =
      selectedUbicacion === 'All' ||
      [c.nombreUbicacion, c.ciudad, c.estado, c.pais]
        .map(val => toTitleCase(val))
        .filter(Boolean)
        .some(val => val === selectedUbicacion);

    const matchesCommercial = !onlyCommercial || c.esEnlaceComercial;

    return (
      matchesSearch &&
      matchesPuesto &&
      matchesEmpresa &&
      matchesTipo &&
      matchesClient &&
      matchesOrganizacion &&
      matchesPlanta &&
      matchesUbicacion &&
      matchesCommercial
    );
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center pb-2">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-[#0b1c30]">Directorio de Enlaces de Planta</h1>
          <p className="text-sm text-slate-500 mt-1">
            Agenda unificada de ingenieros, jefes de instrumentación de calibración y compradores clave en corporativos industriales.
          </p>
        </div>

        <button
          onClick={() => {
            if (role === 'Solo Lectura') {
              alert(`Solo Lectura: No tiene permisos de escritura.`);
              return;
            }
            setIsFormOpen(true);
          }}
          disabled={role === 'Solo Lectura'}
          className={`flex items-center gap-1.5 px-4 py-2 bg-[#004ddf] text-white rounded hover:opacity-90 transition-opacity font-bold text-xs ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
        >
          <Plus className="w-3.5 h-3.5" />
          REGISTRAR ENLACE
        </button>
      </div>

      {/* Filter and Search Bar widget */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ingenieros, puestos o empresas..."
                className="text-xs w-full bg-slate-50 border border-slate-200 py-2 pl-9 pr-3 hover:border-slate-300 outline-none focus:border-[#004ddf] text-[#0b1c30] rounded"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyCommercial}
                onChange={(e) => setOnlyCommercial(e.target.checked)}
                className="rounded text-[#004ddf] focus:ring-1"
              />
              <span className="flex items-center gap-1">
                <UserCheck className="w-4 h-4 text-[#004ddf]" />
                Solo Enlaces Comerciales Clave (🔒)
              </span>
            </label>

            {(search || selectedPuesto !== 'All' || selectedEmpresa !== 'All' || selectedTipo !== 'All' || selectedCliente !== 'All' || selectedOrganizacion !== 'All' || selectedPlanta !== 'All' || selectedUbicacion !== 'All' || onlyCommercial) && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-[#004ddf] hover:underline"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {/* 7 Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Puesto</label>
            <select
              value={selectedPuesto}
              onChange={(e) => setSelectedPuesto(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todos</option>
              {uniquePuestos.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Empresa</label>
            <select
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todas</option>
              {uniqueEmpresas.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Tipo</label>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todos</option>
              {uniqueTipos.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cliente</label>
            <select
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todos</option>
              {uniqueClientes.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Organización</label>
            <select
              value={selectedOrganizacion}
              onChange={(e) => setSelectedOrganizacion(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todas</option>
              {uniqueOrganizaciones.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Planta</label>
            <select
              value={selectedPlanta}
              onChange={(e) => setSelectedPlanta(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todas</option>
              {uniquePlantas.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ubicación</label>
            <select
              value={selectedUbicacion}
              onChange={(e) => setSelectedUbicacion(e.target.value)}
              className="text-xs w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded hover:border-slate-300 outline-none text-[#0b1c30]"
            >
              <option value="All">Todas</option>
              {uniqueUbicaciones.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contacts Cards Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {contacts.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-[#f8fafc] border border-dashed border-slate-200 rounded-xl space-y-3 p-6">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="font-semibold text-sm text-[#0b1c30]">Directorio de contactos vacío</p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Si ya tienes contactos registrados en tu base de datos Supabase, es probable que la tabla <code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono font-bold">Contactos</code> tenga la seguridad RLS activa pero sin permisos públicos de lectura y escritura.
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Ve a la pestaña <strong>Puente Supabase</strong> (o Config. Sheets), copia el script SQL de creación de tablas actualizado y ejecútalo en tu <strong>SQL Editor</strong> de Supabase para otorgar permisos públicos instantáneos de lectura y escritura.
            </p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 italic">
            Ningún contacto coincide con los criterios de búsqueda estructurados.
          </div>
        ) : (
          filteredContacts.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-lg bg-white border shadow-xs flex flex-col justify-between hover:shadow-md transition-all relative group overflow-hidden ${
                c.esEnlaceComercial ? 'border-l-[4px] border-l-[#004ddf] border-slate-200' : 'border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1">
                      {c.prefijoSufijo && (
                        <span className="text-[9px] text-[#004ddf] font-mono uppercase bg-blue-50 border border-blue-100 px-1 py-0.2 rounded font-bold shrink-0">
                          {c.prefijoSufijo}
                        </span>
                      )}
                      <h3 className="font-bold text-[#0b1c30] text-sm truncate max-w-[150px]">{c.nombre}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <p className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-bold uppercase py-0.2 px-1 rounded inline-block font-sans">
                        {c.cliente}
                      </p>
                      {c.empresa && c.empresa !== c.cliente && (
                        <p className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold uppercase py-0.2 px-1 rounded inline-block font-sans">
                          {c.empresa}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {c.esEnlaceComercial && (
                      <span className="p-1 bg-blue-50 border border-blue-100 rounded text-[#004ddf]" title="Enlace Comercial de Alta Afinidad">
                        <UserCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(c.id, c.nombre)}
                      disabled={role !== 'Admin'}
                      title={role !== 'Admin' ? 'Solo Administrador' : 'Eliminar de Agenda'}
                      className="p-1 border border-slate-200 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2 space-y-1 text-xs">
                  <p className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.puesto || 'Puesto no especificado'}</span>
                  </p>
                  <p className="text-slate-400 text-[11px] truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Planta: {c.planta || 'Sin especificar'}</span>
                  </p>
                </div>

                {/* Additional Info toggled on click */}
                {expandedContactIds[c.id] && (
                  <div className="pt-2.5 mt-2.5 border-t border-dashed border-slate-200 space-y-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-md animate-fade-in">
                    {c.tipo && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-500 shrink-0">Tipo:</span>
                        <span className="text-[#0b1c30] font-medium truncate">{c.tipo}</span>
                      </div>
                    )}
                    {c.organizacion && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-500 shrink-0">Org:</span>
                        <span className="text-[#0b1c30] font-medium truncate">{c.organizacion}</span>
                      </div>
                    )}
                    {c.nombreUbicacion && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-500 shrink-0">Ubicación Id:</span>
                        <span className="text-[#0b1c30] font-medium truncate">{c.nombreUbicacion}</span>
                      </div>
                    )}
                    {(c.ciudad || c.estado || c.pais) && (
                      <div className="flex items-start gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-500">Geo:</span>{' '}
                          <span className="text-[#0b1c30] font-medium text-[11px]">
                            {[c.ciudad, c.estado, c.pais].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                    {c.direccion && (
                      <div className="flex items-start gap-1.5">
                        <Home className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-500">Dirección:</span>{' '}
                          <span className="text-[#0b1c30] font-medium text-[11px] block leading-tight">{c.direccion}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 mt-1">
                      <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-400 shrink-0 text-[10px]">ID:</span>
                      <span className="text-slate-400 font-mono select-all text-[9px] truncate max-w-[130px]">{c.id}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle expander button */}
              <button
                onClick={() => toggleExpand(c.id)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-slate-50 hover:bg-slate-100 hover:text-[#004ddf] border border-slate-200 rounded text-[10px] font-bold text-slate-500 transition-all cursor-pointer"
              >
                {expandedContactIds[c.id] ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-[#004ddf]" />
                    <span>OCULTAR DETALLES</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>VER TODOS LOS DETALLES</span>
                  </>
                )}
              </button>

              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2 text-xs">
                <a
                  href={`mailto:${c.email}`}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-[#004ddf] font-semibold transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{c.email}</span>
                </a>
                {c.telefono && c.telefono !== 'N/A' && (
                  <a
                    href={`tel:${c.telefono}`}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-[#004ddf] font-semibold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.telefono}</span>
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: ADD CONTACT FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-xl rounded-lg shadow-xl flex flex-col">
            <header className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#0b1c30] uppercase">Registrar Nuevo Enlace</h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-250 rounded">
                ✕
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
              {/* Información General */}
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-[#0b1c30] mb-2 uppercase text-[10px] tracking-wider text-slate-400">Información General</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Prefijo/Sufijo</label>
                    <input
                      type="text"
                      placeholder="e.g. Ing., Lic."
                      value={prefijoSufijo}
                      onChange={(e) => setPrefijoSufijo(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nombre Completo del Ingeniero*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mónica del Valle"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Roles y Puestos */}
              <div className="border-b border-slate-100 pb-3 space-y-3">
                <h4 className="font-bold text-[#0b1c30] mb-1 uppercase text-[10px] tracking-wider text-slate-400">Roles y Puestos</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Puesto o Cargo*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Directora de Adquisiciones"
                      value={puesto}
                      onChange={(e) => setPuesto(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo de Enlace</label>
                    <input
                      type="text"
                      placeholder="e.g. Socio Comercial, Cliente Final"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Organización y Empresa */}
              <div className="border-b border-slate-100 pb-3 space-y-3">
                <h4 className="font-bold text-[#0b1c30] mb-1 uppercase text-[10px] tracking-wider text-slate-400">Entidades corporativas</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Compañía Cliente*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grupo Bimbo"
                      value={cliente}
                      onChange={(e) => setCliente(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Empresa</label>
                    <input
                      type="text"
                      placeholder="e.g. Bimbo S.A."
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Organización</label>
                    <input
                      type="text"
                      placeholder="e.g. Org de Ventas"
                      value={organizacion}
                      onChange={(e) => setOrganizacion(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Planta y Localización */}
              <div className="border-b border-slate-100 pb-3 space-y-3">
                <h4 className="font-bold text-[#0b1c30] mb-1 uppercase text-[10px] tracking-wider text-slate-400">Planta y Localización</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nombre de la Planta Física*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Planta Toluca"
                      value={planta}
                      onChange={(e) => setPlanta(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Id de Ubicación</label>
                    <input
                      type="text"
                      placeholder="e.g. Bodega Principal"
                      value={nombreUbicacion}
                      onChange={(e) => setNombreUbicacion(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ciudad</label>
                    <input
                      type="text"
                      placeholder="Toluca"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Estado</label>
                    <input
                      type="text"
                      placeholder="EdoMex"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">País</label>
                    <input
                      type="text"
                      placeholder="México"
                      value={pais}
                      onChange={(e) => setPais(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Dirección Completa</label>
                  <input
                    type="text"
                    placeholder="e.g. Av. Tecnológico 1500, Industrial Toluca"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                  />
                </div>
              </div>

              {/* Medios de Contacto */}
              <div className="border-b border-slate-100 pb-3 space-y-3">
                <h4 className="font-bold text-[#0b1c30] mb-1 uppercase text-[10px] tracking-wider text-slate-400">Medios de Contacto</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="example@bimbo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Teléfono de Enlace</label>
                    <input
                      type="text"
                      placeholder="+52 722 612 3456"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-150">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isCommercial}
                    onChange={(e) => setIsCommercial(e.target.checked)}
                    className="rounded text-[#004ddf] focus:ring-1"
                  />
                  <span>Declarar como Enlace Comercial de Alta Prioridad</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-150 text-slate-700 px-3 py-1.5 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#004ddf] text-white px-4 py-1.5 rounded font-bold"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
