import React, { useState } from 'react';
import { Contact, UserRole } from '../types';
import { Phone, Mail, Award, Search, UserCheck, ShieldAlert, Plus, Grid, Trash2 } from 'lucide-react';

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
  const [selectedClient, setSelectedClient] = useState('All');

  // New Contact form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [puesto, setPuesto] = useState('');
  const [cliente, setCliente] = useState('');
  const [planta, setPlanta] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [isCommercial, setIsCommercial] = useState(false);

  // Submit Contact
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para registrar contactos.`);
      return;
    }
    if (!name || !puesto || !cliente || !planta) {
      alert('Por favor complete los campos obligatorios.');
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
      esEnlaceComercial: isCommercial
    };

    onAddContact(nContact);
    onShowAudit('ALTA REGISTRO', `Registró nuevo contacto técnico: ${name} de ${cliente}`);

    // Reset
    setName('');
    setPuesto('');
    setCliente('');
    setPlanta('');
    setEmail('');
    setTelefono('');
    setIsCommercial(false);
    setIsFormOpen(false);
  };

  // Delete Contact
  const handleDelete = (id: string, contactName: string) => {
    if (role !== 'Admin') {
      alert(`🔒 Acción restringida: Solo el rol de Administrador puede remover ingenieros del directorio central.`);
      return;
    }
    if (window.confirm(`¿Está seguro de que desea eliminar el contacto "${contactName}" del directorio?`)) {
      onDeleteContact(id);
      onShowAudit('ELIMINACIÓN', `Removió contacto técnico "${contactName}" del directorio`);
    }
  };

  // Filter unique clients
  const uniqueClients = Array.from(new Set(contacts.map((c) => c.cliente)));

  // Filter directory
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.puesto.toLowerCase().includes(search.toLowerCase()) ||
      c.cliente.toLowerCase().includes(search.toLowerCase());

    const matchesClient = selectedClient === 'All' || c.cliente === selectedClient;
    const matchesCommercial = !onlyCommercial || c.esEnlaceComercial;

    return matchesSearch && matchesClient && matchesCommercial;
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
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ingenieros o puestos..."
              className="text-xs w-full bg-slate-50 border border-slate-200 py-2 pl-9 pr-3 hover:border-slate-300 outline-none focus:border-[#004ddf] text-[#0b1c30]"
            />
          </div>
        </div>

        <div>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="text-xs w-full bg-slate-100 border border-slate-200 py-2 px-2 hover:border-slate-300 outline-none text-[#0b1c30]"
          >
            <option value="All">Filtrar por Corporativo</option>
            {uniqueClients.map((cl) => (
              <option key={cl} value={cl}>
                {cl}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-start md:justify-end items-center">
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
        </div>
      </div>

      {/* Contacts Cards Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredContacts.length === 0 ? (
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
                    <h3 className="font-bold text-[#0b1c30] text-sm truncate max-w-[150px]">{c.nombre}</h3>
                    <p className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-bold uppercase py-0.2 px-1 rounded inline-block mt-1 font-sans">
                      {c.cliente}
                    </p>
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
                  <p className="text-slate-500 font-medium">{c.puesto}</p>
                  <p className="text-slate-400 text-[11px] truncate">{c.planta}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3.5 mt-3.5 space-y-2 text-xs">
                <a
                  href={`mailto:${c.email}`}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-[#004ddf] font-semibold transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{c.email}</span>
                </a>
                <a
                  href={`tel:${c.telefono}`}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-[#004ddf] font-semibold transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.telefono}</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: ADD CONTACT FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#c6c6cd] w-full max-w-sm rounded-lg shadow-xl flex flex-col">
            <header className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#0b1c30] uppercase">Registrar Nuevo Enlace</h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-250 rounded">
                ✕
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Nombre Completo del Ingeniero*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ing. Mónica del Valle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Puesto o Cargo Corporativo*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Directora de Adquisiciones"
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Compañía Cliente*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grupo Bimbo"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                    Planta Física*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Planta Toluca"
                    value={planta}
                    onChange={(e) => setPlanta(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="example@bimbo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-label-caps mb-1">
                  Teléfono de Enlace
                </label>
                <input
                  type="text"
                  placeholder="+52 722 612 3456"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
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
