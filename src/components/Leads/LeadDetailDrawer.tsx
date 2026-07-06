import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CRMRecord, Contact, UserAccount, FollowupEntry } from '../../types';
import { getMexicoCityDateString } from '../../dateUtils';
import { X, Trash2, Plus, FileText, Trophy, Flame, Zap, Snowflake, RefreshCw } from 'lucide-react';

interface LeadDetailDrawerProps {
  isOpen: boolean;
  record: CRMRecord | null;
  onClose: () => void;
  onSave: (record: CRMRecord) => void;
  contacts: Contact[];
  dbUsers: UserAccount[];
  kanbanColumns: string[];
  role: string;
  onAddContact: (contact: Contact) => void;
  onResetStagnation: (record: CRMRecord) => void;
}

export default function LeadDetailDrawer({ 
  isOpen, 
  record, 
  onClose, 
  onSave, 
  contacts, 
  dbUsers, 
  kanbanColumns, 
  role,
  onAddContact,
  onResetStagnation
}: LeadDetailDrawerProps) {
  
  // Estado borrador para no mutar los datos reales hasta dar "Guardar"
  const [draft, setDraft] = useState<CRMRecord | null>(null);
  const [newFollowupNotes, setNewFollowupNotes] = useState('');
  const [newFollowupMethod, setNewFollowupMethod] = useState<'Llamada Telefónica' | 'Correo Electrónico' | 'Revisión Técnica' | 'Visita a Sitio' | 'Minuta de Junta'>('Llamada Telefónica');
  const [newSubtask, setNewSubtask] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Estados para creación rápida de contacto
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactPuesto, setNewContactPuesto] = useState('');
  const [newContactEmpresa, setNewContactEmpresa] = useState('');

  const handleResetDaysInModal = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!draft) return;
    const todayString = getMexicoCityDateString();
    const updatedDraft = {
      ...draft,
      fecha_cambio_etapa: todayString
    };
    setDraft(updatedDraft);
    if (onResetStagnation) {
      onResetStagnation(updatedDraft);
    }
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const handleCreateContactInModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) {
      alert('El nombre del contacto es obligatorio.');
      return;
    }
    const newContact: Contact = {
      id: `c_${Date.now()}`,
      nombre: newContactName.trim(),
      email: newContactEmail.trim() || '',
      telefono: newContactPhone.trim() || '',
      puesto: newContactPuesto.trim() || '',
      empresa: newContactEmpresa.trim() || '',
      cliente: newContactEmpresa.trim() || 'General',
      planta: '',
      esEnlaceComercial: false
    };

    onAddContact(newContact);

    // Auto-select the newly created contact
    if (draft) {
      setDraft({
        ...draft,
        contacto_nombre: newContact.nombre,
        contacto_email: newContact.email,
        contacto_puesto: newContact.puesto,
        contacto_telefono: newContact.telefono,
        contacto_asignado_id: newContact.id
      });
    }

    // Reset form states
    setIsAddingContact(false);
    setNewContactName('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewContactPuesto('');
    setNewContactEmpresa('');
  };

  // Inicializar el borrador cuando se abre el modal
  useEffect(() => {
    if (record && isOpen) {
      setDraft(JSON.parse(JSON.stringify(record))); // Deep copy seguro
    }
  }, [record, isOpen]);

  if (!isOpen || !draft) return null;

  // --- VARIABLES DERIVADAS Y CÁLCULOS EN TIEMPO REAL ---
  const subtasks = Array.isArray(draft.__tareas) ? draft.__tareas : [];
  const completedTasks = subtasks.filter(s => s.completed).length;
  const progressPct = subtasks.length > 0 ? (completedTasks / subtasks.length) * 100 : 0;

  const hw = draft.total_hardware_cotizacion || 0;
  const serv = draft.total_servicios_cotizacion || 0;
  const subtotal = hw + serv;
  // Use defined IVA if available, otherwise compute or keep 0
  const iva = draft.total_iva_cotizacion !== null && draft.total_iva_cotizacion !== undefined ? draft.total_iva_cotizacion : (subtotal * 0.16); 
  const total = subtotal + iva;

  // Asegurar que el formato de acciones_seguimiento sea un arreglo
  const seguimientos: FollowupEntry[] = Array.isArray(draft.acciones_seguimiento) 
    ? draft.acciones_seguimiento 
    : [];

  // --- CONTROLADORES DE ACCIONES ---
  const handleAddLog = () => {
    if (!newFollowupNotes.trim()) return;
    const isUserSaved = localStorage.getItem('verse_google_user');
    const userName = isUserSaved ? JSON.parse(isUserSaved)?.name : 'Operador';
    
    const newEntry: FollowupEntry = {
      id: `fl_${Date.now()}`,
      fecha: getMexicoCityDateString(),
      tipo: newFollowupMethod,
      creador: userName,
      notas: newFollowupNotes.trim()
    };
    
    setDraft({ ...draft, acciones_seguimiento: [newEntry, ...seguimientos] });
    setNewFollowupNotes('');
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    const newTask = { id: `t_${Date.now()}`, text: newSubtask.trim(), completed: false };
    const updatedTasks = [...subtasks, newTask];
    // Se actualizan ambos campos para asegurar compatibilidad con Supabase
    setDraft({ ...draft, __tareas: updatedTasks, checklist_tasks: JSON.stringify(updatedTasks) });
    setNewSubtask('');
  };

  const toggleSubtask = (taskId: string) => {
    const updatedTasks = subtasks.map(s => s.id === taskId ? { ...s, completed: !s.completed } : s);
    setDraft({ ...draft, __tareas: updatedTasks, checklist_tasks: JSON.stringify(updatedTasks) });
  };

  const removeSubtask = (taskId: string) => {
    const updatedTasks = subtasks.filter(s => s.id !== taskId);
    setDraft({ ...draft, __tareas: updatedTasks, checklist_tasks: JSON.stringify(updatedTasks) });
  };

  const renderTemperatureBadge = (temp: string | null | undefined) => {
    if (temp === 'Win') return <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border border-emerald-200"><Trophy className="w-3 h-3"/> WIN</span>;
    if (temp === 'Hot') return <span className="text-red-600 bg-red-50 px-2 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border border-red-200"><Flame className="w-3 h-3"/> HOT</span>;
    if (temp === 'Warm') return <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border border-amber-200"><Zap className="w-3 h-3"/> WARM</span>;
    return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border border-blue-200"><Snowflake className="w-3 h-3"/> COOL</span>;
  };

  // Renderizamos usando createPortal para asegurar que el drawer flote sobre toda la app
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-sm">
      {/* Panel Lateral Animado */}
      <div className="w-full max-w-5xl bg-[#f8fafc] shadow-2xl flex flex-col h-full border-l border-slate-300 transform transition-transform duration-300">
        
        {/* HEADER */}
        <header className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Consola de Licitación Comercial B2B</span>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Licitación {draft.informacion_general_folio || 'S/F'}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {renderTemperatureBadge(draft.status_proyecto || draft.nivel_termo)}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* CONTENIDO (2 COLUMNAS) */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMNA IZQUIERDA (60%) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Información de Identidad */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-4">Información de Identidad</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nombre del Proyecto</label>
                    <input
                      type="text"
                      value={draft.informacion_general_proyecto || ''}
                      onChange={e => setDraft({ ...draft, informacion_general_proyecto: e.target.value })}
                      disabled={role === 'Solo Lectura'}
                      className="w-full border border-slate-200 py-2.5 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Cliente Legal</label>
                    <input
                      type="text"
                      value={draft.informacion_general_cliente || ''}
                      onChange={e => setDraft({ ...draft, informacion_general_cliente: e.target.value })}
                      disabled={role === 'Solo Lectura'}
                      className="w-full border border-slate-200 py-2.5 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Tareas de la Etapa Actual */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">Tareas de la Etapa Actual</h4>
                  <span className="text-[10px] bg-slate-100 font-bold px-3 py-1 rounded-full text-slate-600">
                    {completedTasks}/{subtasks.length} completadas
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
                </div>

                {/* Lista de Tareas */}
                <div className="space-y-2 mb-4">
                  {subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubtask(sub.id)}
                          disabled={role === 'Solo Lectura'}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className={`text-sm ${sub.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{sub.text}</span>
                      </label>
                      {role !== 'Solo Lectura' && (
                        <button onClick={() => removeSubtask(sub.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">No hay tareas definidas para esta etapa.</p>
                  )}
                </div>

                {/* Formulario Agregar Tarea */}
                {role !== 'Solo Lectura' && (
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={e => setNewSubtask(e.target.value)}
                      placeholder="Agregar un nuevo requerimiento / tarea..."
                      className="flex-1 border border-slate-200 py-2 px-3 rounded-lg text-sm outline-none focus:border-blue-500"
                    />
                    <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer">
                      Agregar
                    </button>
                  </form>
                )}
              </div>

              {/* Nuevo Log / Reporte */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-4">Nuevo Log / Reporte de Avance</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Método de Contacto</label>
                    <select 
                      value={newFollowupMethod} 
                      onChange={e => setNewFollowupMethod(e.target.value as any)} 
                      className="w-full sm:w-1/2 border border-slate-200 py-2 px-3 rounded-lg text-sm outline-none focus:border-blue-500 text-slate-700 font-medium bg-white"
                    >
                      <option value="Llamada Telefónica">Llamada Telefónica</option>
                      <option value="Correo Electrónico">Correo Electrónico</option>
                      <option value="Revisión Técnica">Revisión Técnica</option>
                      <option value="Visita a Sitio">Visita a Sitio</option>
                      <option value="Minuta de Junta">Minuta de Junta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Notas del Seguimiento</label>
                    <textarea
                      value={newFollowupNotes}
                      onChange={e => setNewFollowupNotes(e.target.value)}
                      rows={3}
                      placeholder="Describa el avance comercial obtenido de manera detallada..."
                      className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm outline-none focus:border-blue-500 resize-none text-slate-700"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddLog} 
                      disabled={role === 'Solo Lectura' || !newFollowupNotes.trim()} 
                      className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4"/> Guardar Avance
                    </button>
                  </div>
                </div>
              </div>

              {/* Historial de Seguimiento B2B */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-6">Historial de Seguimiento B2B</h4>
                <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                  {seguimientos.map((f, i) => (
                    <div key={f.id || i} className="relative">
                      {/* Punto azul de la línea de tiempo */}
                      <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white" />
                      
                      <div className="text-[10px] text-slate-400 font-bold mb-1">{f.fecha}</div>
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">{f.tipo} - {f.creador}</div>
                      <div className="text-sm text-slate-600 mt-2 bg-slate-50 p-3.5 rounded-lg border border-slate-100 leading-relaxed shadow-sm">
                        {f.notas}
                      </div>
                    </div>
                  ))}
                  {seguimientos.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No hay interacciones registradas en la bitácora.</p>
                  )}
                </div>
              </div>

            </div>

            {/* COLUMNA DERECHA (40%) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Valores de Cotización */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-4">Valores de Cotización</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Coste Suministros (HW)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                      <input 
                        type="number" 
                        value={draft.total_hardware_cotizacion !== null && draft.total_hardware_cotizacion !== undefined ? draft.total_hardware_cotizacion : ''} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          const nextHw = val;
                          const nextServ = draft.total_servicios_cotizacion || 0;
                          const nextSubtotal = nextHw + nextServ;
                          const nextIva = nextSubtotal * 0.16;
                          const nextTotal = nextSubtotal + nextIva;
                          
                          setDraft({
                            ...draft, 
                            total_hardware_cotizacion: e.target.value === '' ? null : val, 
                            total_subtotal_cotizacion: nextSubtotal, 
                            total_iva_cotizacion: nextIva,
                            total_general_cotizacion: nextTotal 
                          });
                        }} 
                        disabled={role==='Solo Lectura'} 
                        className="w-full border border-slate-200 py-2 pl-7 pr-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Coste Integ (Servicios)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                      <input 
                        type="number" 
                        value={draft.total_servicios_cotizacion !== null && draft.total_servicios_cotizacion !== undefined ? draft.total_servicios_cotizacion : ''} 
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          const nextHw = draft.total_hardware_cotizacion || 0;
                          const nextServ = val;
                          const nextSubtotal = nextHw + nextServ;
                          const nextIva = nextSubtotal * 0.16;
                          const nextTotal = nextSubtotal + nextIva;

                          setDraft({
                            ...draft, 
                            total_servicios_cotizacion: e.target.value === '' ? null : val, 
                            total_subtotal_cotizacion: nextSubtotal, 
                            total_iva_cotizacion: nextIva,
                            total_general_cotizacion: nextTotal 
                          });
                        }} 
                        disabled={role==='Solo Lectura'} 
                        className="w-full border border-slate-200 py-2 pl-7 pr-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Resumen Financiero Automático */}
                <div className="mt-5 bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2.5 text-sm shadow-inner">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-slate-700">${subtotal.toLocaleString('en-US', {minimumFractionDigits: 2})} {draft.informacion_general_moneda}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA Trasladado (16%):</span>
                    <span className="font-mono font-bold text-slate-700">${iva.toLocaleString('en-US', {minimumFractionDigits: 2})} {draft.informacion_general_moneda}</span>
                  </div>
                  <div className="flex justify-between text-blue-700 font-black text-base pt-3 border-t border-slate-200 mt-2">
                    <span>Total General:</span>
                    <span className="font-mono">${total.toLocaleString('en-US', {minimumFractionDigits: 2})} {draft.informacion_general_moneda}</span>
                  </div>
                </div>
              </div>

              {/* Ubicación de Operación */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-4">Ubicación de Operación</h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Planta Industrial</label>
                  <input 
                    type="text" 
                    value={draft.informacion_general_planta || ''} 
                    onChange={e => setDraft({...draft, informacion_general_planta: e.target.value})} 
                    disabled={role==='Solo Lectura'} 
                    className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" 
                  />
                </div>
              </div>

              {/* Parámetros de Proceso */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-4">Parámetros de Proceso</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Etapa Actual en Pipeline</label>
                    <select 
                      value={draft.etapa || draft.estado_proyecto || 'Nuevo'} 
                      onChange={e => setDraft({...draft, etapa: e.target.value, estado_proyecto: e.target.value as any, fecha_cambio_etapa: getMexicoCityDateString()})} 
                      disabled={role==='Solo Lectura'} 
                      className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50"
                    >
                      {kanbanColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Responsable Asignado</label>
                    <select 
                      value={draft.responsable || ''} 
                      onChange={e => setDraft({...draft, responsable: e.target.value})} 
                      disabled={role==='Solo Lectura'} 
                      className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Sin Asignar --</option>
                      {dbUsers && dbUsers.length > 0 ? (
                        dbUsers.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)
                      ) : (
                        <option value="Geovanni Andrade">Geovanni Andrade</option>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase" title="Días límite antes de marcar como estancado">
                          Alerta Estancamiento
                        </label>
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition-all duration-300 ${
                          resetSuccess 
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200 animate-pulse' 
                            : 'text-amber-600 bg-amber-50 border-amber-200'
                        }`}>
                          <span>
                            {resetSuccess ? '✓ ¡Reiniciado!' : `⏱️ ${(() => {
                              const dateStr = draft.fecha_cambio_etapa || draft.fecha_registro;
                              if (!dateStr) return 0;
                              try {
                                const todayString = getMexicoCityDateString();
                                const d1 = new Date(todayString);
                                const dateOnlyStr = dateStr.trim().substring(0, 10);
                                const d2 = new Date(dateOnlyStr);
                                const diffTime = d1.getTime() - d2.getTime();
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                return isNaN(diffDays) || diffDays < 0 ? 0 : diffDays;
                              } catch {
                                return 0;
                              }
                            })()}d`}
                          </span>
                          {role !== 'Solo Lectura' && !resetSuccess && (
                            <button
                              type="button"
                              onClick={handleResetDaysInModal}
                              className="p-0.5 text-blue-600 hover:text-blue-800 rounded hover:bg-amber-100 transition-colors cursor-pointer"
                              title="Reiniciar estancamiento (restablecer fecha a hoy)"
                            >
                              <RefreshCw className="w-3 h-3 hover:rotate-45 transition-transform" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={draft.stagnation_days_limit ?? 5} 
                          onChange={e => setDraft({...draft, stagnation_days_limit: Number(e.target.value)})} 
                          disabled={role==='Solo Lectura'} 
                          className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" 
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">Días</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nivel de Interés</label>
                      <select 
                        value={draft.status_proyecto || draft.nivel_termo || 'Warm'} 
                        onChange={e => setDraft({...draft, status_proyecto: e.target.value as any, nivel_termo: e.target.value})} 
                        disabled={role==='Solo Lectura'} 
                        className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="Win">Win</option>
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cool">Cool</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contacto del Cliente */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">Contacto del Cliente</h4>
                  {role !== 'Solo Lectura' && !isAddingContact && (
                    <button
                      type="button"
                      onClick={() => setIsAddingContact(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuevo Contacto
                    </button>
                  )}
                </div>

                {isAddingContact ? (
                  <form onSubmit={handleCreateContactInModal} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                      <span className="text-xs font-extrabold text-slate-800">Crear y Asociar Nuevo Contacto</span>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingContact(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Juan Pérez"
                          value={newContactName}
                          onChange={e => setNewContactName(e.target.value)}
                          className="w-full border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          placeholder="juan@correo.com"
                          value={newContactEmail}
                          onChange={e => setNewContactEmail(e.target.value)}
                          className="w-full border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Teléfono</label>
                        <input
                          type="text"
                          placeholder="5512345678"
                          value={newContactPhone}
                          onChange={e => setNewContactPhone(e.target.value)}
                          className="w-full border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Puesto / Cargo</label>
                        <input
                          type="text"
                          placeholder="Gerente de Compras"
                          value={newContactPuesto}
                          onChange={e => setNewContactPuesto(e.target.value)}
                          className="w-full border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Empresa</label>
                        <input
                          type="text"
                          placeholder="Nombre de la empresa"
                          value={newContactEmpresa}
                          onChange={e => setNewContactEmpresa(e.target.value)}
                          className="w-full border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer mt-2"
                    >
                      Guardar y Vincular Contacto
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Buscador Inteligente de Contactos</label>
                      <div className="relative">
                        <select 
                          value={draft.contacto_nombre || ''} 
                          onChange={e => {
                            const c = contacts.find(con => con.nombre === e.target.value);
                            if (c) {
                              setDraft({
                                ...draft, 
                                contacto_nombre: c.nombre, 
                                contacto_email: c.email, 
                                contacto_puesto: c.puesto, 
                                contacto_telefono: c.telefono, 
                                contacto_asignado_id: c.id
                              });
                            } else {
                              setDraft({
                                ...draft, 
                                contacto_nombre: null, 
                                contacto_email: null, 
                                contacto_puesto: null, 
                                contacto_telefono: null, 
                                contacto_asignado_id: null
                              });
                            }
                          }} 
                          disabled={role==='Solo Lectura'} 
                          className="w-full border border-slate-200 py-2 px-3 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white cursor-pointer"
                        >
                          <option value="">-- Seleccionar o Vincular Contacto --</option>
                          {contacts.map(c => (
                            <option key={c.id} value={c.nombre}>
                              {c.nombre} {c.puesto ? `(${c.puesto})` : ''} {c.empresa ? `- ${c.empresa}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Tarjeta Visual del Contacto Asignado */}
                    {draft.contacto_nombre ? (
                      <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg space-y-1.5 shadow-sm relative group">
                        <p className="font-extrabold text-blue-900 text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {draft.contacto_nombre}
                        </p>
                        <p className="text-blue-700 text-xs font-medium pl-4">{draft.contacto_puesto || 'Puesto no especificado'}</p>
                        <p className="text-blue-600 font-mono text-[11px] mt-2 pl-4">{draft.contacto_email || 'Sin correo'}</p>
                        <p className="text-blue-600 font-mono text-[11px] pl-4">{draft.contacto_telefono || 'Sin teléfono'}</p>
                        
                        {role !== 'Solo Lectura' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraft({
                                ...draft,
                                contacto_nombre: null,
                                contacto_email: null,
                                contacto_puesto: null,
                                contacto_telefono: null,
                                contacto_asignado_id: null
                              });
                            }}
                            className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-white px-1.5 py-0.5 rounded border border-red-100 shadow-3xs"
                          >
                            Desvincular
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 p-4 rounded-lg text-center text-slate-400 text-xs font-medium bg-slate-50">
                        No hay contacto asignado a este proyecto.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* FOOTER ACCIONES */}
        <footer className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onSave(draft)} 
            disabled={role === 'Solo Lectura'} 
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            Guardar Cambios
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
