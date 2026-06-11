import React, { useState } from 'react';
import { AuditLog, UserRole } from '../types';
import { ShieldCheck, Trash2, ShieldAlert, Lock, Search, FileDown } from 'lucide-react';

interface AuditSectionProps {
  logs: AuditLog[];
  role: UserRole;
  onClearLogs: () => void;
}

export default function AuditSection({ logs, role, onClearLogs }: AuditSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleClear = () => {
    if (role !== 'Admin') {
      alert(`🔒 Acción Restringida: Solo el perfil de Administrador ("Admin") está autorizado para vaciar la bitácora técnica de seguridad.`);
      return;
    }
    if (window.confirm('¿Está seguro de que desea vaciar por completo la bitácora de seguridad? Esta acción eliminará el rastro de auditoría actual.')) {
      onClearLogs();
    }
  };

  const filteredLogs = logs.filter((l) => {
    return (
      l.operador.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.detalles.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.perfil.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-2 gap-3">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-[#0b1c30]">Libro de Bitácora de Seguridad (Auditoría)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro inmutable de transacciones, altas y eliminaciones para cumplimiento B2B de Verse CRM.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleClear}
          disabled={role !== 'Admin'}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-bold rounded transition-colors ${
            role === 'Admin'
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-450 border border-slate-200 cursor-not-allowed'
          }`}
        >
          {role === 'Admin' ? <Trash2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
          VACIAR BITÁCORA {role !== 'Admin' && '(🔒)'}
        </button>
      </div>

      {/* Statistics and summary widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#f8f9ff] border border-blue-100 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 text-[#004ddf] rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-label-caps">Estado de Trazabilidad</p>
            <p className="text-sm font-bold text-[#0b1c30]">Activo e Íntegro</p>
          </div>
        </div>

        <div className="bg-[#f8f9ff] border border-blue-100 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center">
            <Search className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-label-caps">Registros Acumulados</p>
            <p className="text-sm font-bold text-[#0b1c30]">{logs.length} Operaciones</p>
          </div>
        </div>

        <div className="bg-[#f8f9ff] border border-blue-100 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 text-[#10B981] rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-label-caps">Operador Registrado</p>
            <p className="text-xs font-bold text-[#004ddf] font-mono leading-none truncate max-w-[150px]">
              geovanni@verse-technology.com
            </p>
          </div>
        </div>
      </div>

      {/* Table search filter */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden space-y-4 p-4">
        <div className="flex justify-between items-center flex-wrap gap-2.5 pb-2 border-b border-slate-100">
          <h3 className="font-title-sm text-sm font-semibold text-[#0b1c30]">Filtrado de Auditoría</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por acción, operador o folio..."
            className="text-xs w-full sm:max-w-xs bg-slate-50 border border-slate-200 py-1.5 px-3 outline-none focus:border-[#004ddf] text-[#0b1c30]"
          />
        </div>

        <div className="overflow-x-auto border border-slate-150 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-500 uppercase font-bold font-label-caps">
              <tr>
                <th className="p-3">Marca de Tiempo</th>
                <th className="p-3">Acción Registrada</th>
                <th className="p-3">Operador Cargo</th>
                <th className="p-3">Perfil Asignado</th>
                <th className="p-3">Descripción Detalle de Operación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                    Sin eventos registrados en la bitácora de seguridad.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-400 font-data-mono font-semibold white-space-nowrap">
                      [{item.fecha}]
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-1.5 py-0.2 rounded font-sans font-bold text-[9px] uppercase hover:opacity-90 border ${
                        item.accion === 'ELIMINACIÓN'
                          ? 'bg-red-50 text-red-700 border-red-150'
                          : item.accion === 'ALTA REGISTRO'
                            ? 'bg-blue-50 text-blue-700 border-blue-150'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-150'
                      }`}>
                        {item.accion}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-mono text-[11px] font-bold">
                      {item.operador}
                    </td>
                    <td className="p-3">
                      <span className="text-[#0b1c30] font-semibold text-xs">{item.perfil}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium font-sans">
                      {item.detalles}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
