import React, { useState } from 'react';
import { CRMRecord, UserRole } from '../types';
import { FileCheck, BookOpen, AlertCircle, Trash, Lock, FileSpreadsheet, Plus, ExternalLink, Calendar } from 'lucide-react';

interface PurchaseOrdersSectionProps {
  records: CRMRecord[];
  role: UserRole;
  onUpdateRecord: (record: CRMRecord) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function PurchaseOrdersSection({
  records,
  role,
  onUpdateRecord,
  onShowAudit
}: PurchaseOrdersSectionProps) {
  // Select active pending project
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Form values
  const [folioOC, setFolioOC] = useState('');
  const [linkOC, setLinkOC] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [instalacionIncluida, setInstalacionIncluida] = useState(true);

  // Filter won contracts (Cerrado Ganado)
  const wonContracts = records.filter((r) => r.estado_proyecto === 'Cerrado Ganado');
  
  // Filter candidates (Propuesta / Negociación)
  const pendingContracts = records.filter((r) => r.estado_proyecto !== 'Cerrado Ganado');

  // Map PO formalization
  const handleFormalize = (e: React.FormEvent) => {
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
      fecha_inicio_proyecto: fechaInicio || new Date().toISOString().split('T')[0],
      informacion_general_instalacion_incluida: instalacionIncluida
    };

    onUpdateRecord(updatedRecord);
    onShowAudit('MODIFICACIÓN', `Formalizó y Vinculó Orden de Compra ${folioOC} para folio ${baseProject.informacion_general_folio} (${baseProject.informacion_general_cliente})`);
    
    // Reset
    setSelectedProjectId('');
    setFolioOC('');
    setLinkOC('');
    setFechaInicio('');
    alert(`¡Orden de compra vinculada con éxito! El proyecto pasó a estado 'Cerrado Ganado' y ya es visible en la bitácora logística.`);
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="pb-2 text-left">
        <h1 className="text-2xl font-bold text-[#0b1c30]">Órdenes de Compra (Cierre de Negocio)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Formalización legal de oportunidades comerciales en México. Vinculación de folios de OC para el inicio de instalación y logística en planta.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Main interactive form to link a PO */}
        <div className="col-span-12 xl:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Plus className="text-[#004ddf] w-4.5 h-4.5" />
              Mapeo e Integración de O.C.
            </h3>

            {role === 'Solo Lectura' ? (
              <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2 text-xs rounded flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Bloqueo del Rol Activo: Cambia tu rol a Administrador o Vendedor para registrar órdenes.</span>
              </div>
            ) : null}

            <form onSubmit={handleFormalize} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                  1. Oportunidad o Lead Comercial*
                </label>
                <select
                  disabled={role === 'Solo Lectura'}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                >
                  <option value="">Seleccione un proyecto en negociación...</option>
                  {pendingContracts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.informacion_general_folio} • {p.informacion_general_cliente} ({p.informacion_general_proyecto})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                    Folio Único OC*
                  </label>
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="text"
                    required
                    placeholder="e.g. OC-BIMBO-990-23"
                    value={folioOC}
                    onChange={(e) => setFolioOC(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] font-data-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                    Fecha de Lanzamiento
                  </label>
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                  Hipervínculo Seguro PDF en Google Drive
                </label>
                <input
                  disabled={role === 'Solo Lectura'}
                  type="url"
                  placeholder="https://drive.google.com/file/d/signed_sheet..."
                  value={linkOC}
                  onChange={(e) => setLinkOC(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2 text-[#0b1c30] outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 border border-slate-200 rounded">
                <p className="font-bold text-[#0b1c30] mb-2 font-sans text-xs">Cláusulas de Cumplimiento Logístico:</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    disabled={role === 'Solo Lectura'}
                    type="checkbox"
                    checked={instalacionIncluida}
                    onChange={(e) => setInstalacionIncluida(e.target.checked)}
                    className="rounded text-[#004ddf] focus:ring-1"
                  />
                  <span className="font-semibold text-slate-700">Incluir servicios de instalación fìsica y calibracion en planta</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={role === 'Solo Lectura'}
                className={`w-full bg-[#004ddf] text-white font-bold py-2.5 hover:opacity-95 transition-opacity rounded ${role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''}`}
              >
                VINCULAR Y CERRAR NEGOCIO
              </button>
            </form>
          </div>
        </div>

        {/* List of successfully won purchase orders */}
        <div className="col-span-12 xl:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <FileCheck className="text-emerald-500 w-4.5 h-4.5" />
                Cartera de Ordenes Formalizadas ({wonContracts.length})
              </span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 font-sans uppercase">
                Logística Activa
              </span>
            </h3>

            <div className="space-y-3.5">
              {wonContracts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  Ninguna orden de compra formalizada en la cartera actual.
                </div>
              ) : (
                wonContracts.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-all grid grid-cols-1 md:grid-cols-12 gap-3"
                  >
                    <div className="md:col-span-4">
                      <p className="text-xs font-bold text-[#0b1c30]">{c.informacion_general_cliente}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">{c.informacion_general_proyecto}</p>
                      <p className="text-[9px] font-semibold text-blue-700 font-mono mt-1">Folio Ref: {c.informacion_general_folio}</p>
                    </div>

                    <div className="md:col-span-4">
                      <p className="text-[9px] uppercase font-bold text-slate-400 font-label-caps">Fila de Registro de OC</p>
                      <p className="text-xs font-bold font-data-mono text-emerald-600 mt-0.5">{c.folio_orden_compra || 'N/A'}</p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-1 font-semibold">
                        <Calendar className="w-3 h-3" />
                        Lanzamiento: {c.fecha_inicio_proyecto || 'N/A'}
                      </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col justify-between items-end text-right">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-400 font-label-caps">Monto Formal</p>
                        <p className="text-sm font-bold font-data-mono text-[#0b1c30]">
                          {c.total_general_cotizacion.toLocaleString('en-US', {
                            style: 'currency',
                            currency: c.informacion_general_moneda,
                            minimumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        {c.informacion_general_instalacion_incluida ? (
                          <span className="bg-blue-50 text-[#004ddf] text-[9px] font-bold px-1.5 py-0.2 rounded border border-blue-100 uppercase">
                            Instalación ✔
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase">
                            Solo Suministro
                          </span>
                        )}

                        {c.link_orden_compra && (
                          <a
                            href={c.link_orden_compra}
                            target="_blank"
                            rel="referrer"
                            className="bg-emerald-50 text-emerald-800 p-0.5 px-1.5 hover:bg-emerald-100 rounded text-[9px] font-bold border border-emerald-100 flex items-center gap-0.5 transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Drive
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
