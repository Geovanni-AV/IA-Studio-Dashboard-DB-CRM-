import React, { useState } from 'react';
import { CRMRecord, FollowupEntry, UserRole } from '../types';
import { MessageSquare, Phone, Mail, Settings, User, Compass, Calendar, AlertCircle } from 'lucide-react';

interface FollowupsSectionProps {
  records: CRMRecord[];
  role: UserRole;
  onUpdateRecord: (record: CRMRecord) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function FollowupsSection({
  records,
  role,
  onUpdateRecord,
  onShowAudit
}: FollowupsSectionProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  
  // Followup form fields
  const [tipo, setTipo] = useState<'Llamada Telefónica' | 'Correo Electrónico' | 'Revisión Técnica' | 'Visita a Sitio' | 'Minuta de Junta'>('Llamada Telefónica');
  const [creador, setCreador] = useState(role === 'Admin' ? 'Carlos (Director)' : 'Laura (Ventas)');
  const [notas, setNotas] = useState('');

  const activeRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  // Submit Followup entry
  const handleAddFollowup = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" tiene bloqueado el registro en Bitácora Comercial.`);
      return;
    }
    if (!notas.trim()) {
      alert('Por favor ingrese las notas del seguimiento.');
      return;
    }

    const newEntry: FollowupEntry = {
      id: `fl_${Date.now()}`,
      fecha: new Date().toISOString().substring(0, 16).replace('T', ' '),
      tipo,
      creador: creador || 'Operador',
      notas: notas.trim()
    };

    const updatedRecord: CRMRecord = {
      ...activeRecord,
      acciones_seguimiento: [newEntry, ...activeRecord.acciones_seguimiento]
    };

    onUpdateRecord(updatedRecord);
    onShowAudit('MODIFICACIÓN', `Registró nota de seguimiento comercial (${tipo}) en folio ${activeRecord.informacion_general_folio}`);

    // Reset notes
    setNotas('');
    alert(`¡Nota de seguimiento agregada exitosamente a la bitácora comercial!`);
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'Llamada Telefónica':
        return <Phone className="w-4.5 h-4.5 text-blue-600" />;
      case 'Correo Electrónico':
        return <Mail className="w-4.5 h-4.5 text-emerald-600" />;
      case 'Revisión Técnica':
        return <Settings className="w-4.5 h-4.5 text-orange-600" />;
      case 'Visita a Sitio':
        return <Compass className="w-4.5 h-4.5 text-purple-600" />;
      default:
        return <MessageSquare className="w-4.5 h-4.5 text-slate-600" />;
    }
  };

  const getTimelineBadgeStyle = (type: string) => {
    switch (type) {
      case 'Llamada Telefónica':
        return 'bg-blue-100 border-blue-200 text-blue-800';
      case 'Correo Electrónico':
        return 'bg-emerald-100 border-emerald-200 text-emerald-800';
      case 'Revisión Técnica':
        return 'bg-amber-100 border-amber-200 text-amber-800';
      case 'Visita a Sitio':
        return 'bg-purple-100 border-purple-200 text-purple-800';
      default:
        return 'bg-slate-100 border-slate-200 text-slate-800';
    }
  };

  if (!activeRecord) {
    return <div className="p-8 text-center text-slate-400">Cargando bitácora comercial...</div>;
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="pb-2 text-left">
        <h1 className="text-2xl font-bold text-[#0b1c30]">Bitácora de Seguimiento Comercial</h1>
        <p className="text-sm text-slate-500 mt-1">
          Línea de tiempo unificada para el registro de contactos técnicos, minutas de junta, acuerdos cambiarios e hitos logísticos en sitio.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Selector and Bitacora creation form */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                Expediente a Visualizar
              </label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.informacion_general_folio} • {r.informacion_general_cliente}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-[#0b1c30] uppercase mb-3 px-0.2">
                Añadir Entrada de Seguro
              </h4>

              {role === 'Solo Lectura' ? (
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded border border-amber-200 text-xs flex items-center gap-1.5 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>Solo Lectura: No tiene habilitadas las notas.</span>
                </div>
              ) : null}

              <form onSubmit={handleAddFollowup} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    Tipo de Interacción
                  </label>
                  <select
                    disabled={role === 'Solo Lectura'}
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  >
                    <option value="Llamada Telefónica">📞 Llamada Telefónica</option>
                    <option value="Correo Electrónico">✉ Correo Electrónico</option>
                    <option value="Revisión Técnica">🔧 Revisión Técnica</option>
                    <option value="Visita a Sitio">📍 Visita a Sitio</option>
                    <option value="Minuta de Junta">🗒 Minuta de Junta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    Autor / Gestor Registrado
                  </label>
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="text"
                    required
                    value={creador}
                    onChange={(e) => setCreador(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                    Descripción / Notas Técnicas
                  </label>
                  <textarea
                    disabled={role === 'Solo Lectura'}
                    required
                    placeholder="Escriba aquí los compromisos alcanzados en la junta, visitas o llamadas..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={4}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={role === 'Solo Lectura'}
                  className={`w-full bg-[#004ddf] text-white font-bold py-2 hover:opacity-90 transition-opacity rounded ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
                >
                  REGISTRAR EN BITÁCORA
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Visual Timeline Panel */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center bg-slate-50/50 p-3 rounded">
            <div>
              <p className="text-[10px] text-[#004ddf] font-bold font-mono">CLIENTE: {activeRecord.informacion_general_cliente.toUpperCase()}</p>
              <h3 className="text-base font-bold text-[#0b1c30] mt-0.5">
                Línea de Tiempo Operativa ({activeRecord.acciones_seguimiento.length} hitos)
              </h3>
            </div>
            <span className="bg-blue-100 text-[#004ddf] text-xs font-data-mono px-2 py-0.5 rounded font-bold uppercase border border-blue-200">
              {activeRecord.informacion_general_folio}
            </span>
          </div>

          <div className="relative pl-6 border-l border-slate-200 space-y-5 py-2">
            {activeRecord.acciones_seguimiento.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs pl-0">
                Aún no existen registros en la bitácora para este folio comercial. Añade una nota a la izquierda.
              </div>
            ) : (
              activeRecord.acciones_seguimiento.map((item, index) => (
                <div key={item.id || index} className="relative space-y-2 group">
                  {/* Left node decoration indicator */}
                  <div className="absolute left-[-35px] top-1 w-6.5 h-6.5 bg-slate-50 border border-slate-300 rounded-full flex items-center justify-center shadow-xs">
                    {getTimelineIcon(item.tipo)}
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-150 rounded-lg shadow-2xs group-hover:bg-slate-100/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.2 rounded-xs border text-[10px] uppercase font-bold font-sans ${getTimelineBadgeStyle(item.tipo)}`}>
                          {item.tipo}
                        </span>
                        <span className="text-xs text-slate-700 font-bold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-450" />
                          {item.creador}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-data-mono flex items-center gap-1 font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.fecha}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-900 font-medium leading-relaxed">
                      {item.notas}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
