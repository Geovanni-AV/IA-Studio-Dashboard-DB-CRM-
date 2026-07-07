import React, { useState, useEffect } from 'react';
import { AuditLog, UserRole } from '../types';
import { ShieldCheck, Trash2, ShieldAlert, Lock, Search, Loader2 } from 'lucide-react';
// IMPORTACIONES NUEVAS PARA FASE 2 Y 5
import { getSupabaseClient, getResolvedAuditLogsTableName, mapRawAuditLog } from '../supabaseService';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AuditSectionProps {
  // Eliminamos 'logs' y 'onClearLogs' de las props porque ahora se manejan internamente
  role: UserRole;
  onShowAudit?: (action: string, details: string) => void;
}

export default function AuditSection({ role, onShowAudit }: AuditSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Instanciamos el cliente para poder invalidar la caché manualmente si borramos datos
  const queryClient = useQueryClient();

  // Validación de seguridad original
  useEffect(() => {
    if (role !== 'Admin' && onShowAudit) {
      onShowAudit('ANOMALÍA', `Intento de acceso denegado a la bitácora técnica de seguridad por parte de un usuario con perfil: [${role}]`);
    }
  }, [role, onShowAudit]);

  // FASE 5: FETCHING INTELIGENTE CON CACHÉ (Reemplaza a useEffect y useState)
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'], // El nombre de la "carpeta" en la caché
    queryFn: async () => {
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      const client = getSupabaseClient(url, key);

      if (!client) throw new Error("Cliente no inicializado");

      const { data, error } = await client
        .from(getResolvedAuditLogsTableName())
        .select('*')
        .order('fecha', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data.map(mapRawAuditLog);
    },
    enabled: role === 'Admin', // Evita que la consulta se dispare si no es Admin
  });

  // FASE 5: BORRADO Y REFRESCO DE CACHÉ
  const handleClear = async () => {
    if (role !== 'Admin') return;
    if (window.confirm('¿Está seguro de que desea vaciar por completo la bitácora de seguridad en Supabase? Esta acción es irreversible.')) {
      
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      const client = getSupabaseClient(url, key);
      
      if (client) {
         await client.from(getResolvedAuditLogsTableName()).delete().neq('id', '0');
      }
      
      // INVALIDACIÓN: Le decimos a React Query que su caché ya no sirve y debe redibujar la vista
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });

      if (onShowAudit) onShowAudit('RESTABLECIMIENTO', 'Bitácora técnica de seguridad depurada e inicializada por el Administrador.');
    }
  };

  if (role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto space-y-6 animate-in fade-in duration-300" id="unauthorized-audit-container">
        <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-500 shadow-md">
          <Lock className="w-10 h-10 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#0b1c30]">Acceso Altamente Restringido</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            La bitácora de auditoría y registros inmutables de seguridad operativa contiene datos de cumplimiento que solo están disponibles para usuarios con el rol de <span className="font-bold text-[#004ddf]">Administrador</span>.
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-150 text-left w-full space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Detalle de Seguridad
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Su sesión actual como <span className="font-semibold text-slate-700">[{role}]</span> no tiene autorizado el acceso de lectura a los flujos operativos. Un intento de acceso ha sido advertido al sistema para su análisis de anomalías.
          </p>
        </div>
      </div>
    );
  }

  const formatAuditDate = (utcTimestampStr: string) => {
    if (!utcTimestampStr) return 'Fecha no disponible'; // Cláusula de guardia Failsafe para valores nulos
    try {
      const date = new Date(utcTimestampStr);
      return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) {
      return utcTimestampStr; // Fallback string en caso de error de parseo
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
          <h1 className="text-2xl font-bold text-[#0b1c30] flex items-center gap-2">
            Libro de Bitácora de Seguridad 
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[#004ddf]" />}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro inmutable de transacciones, altas y eliminaciones para cumplimiento B2B de Verse CRM.
          </p>
        </div>

        <button
          onClick={handleClear}
          disabled={isLoading}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-bold rounded transition-colors bg-red-600 hover:bg-red-700 text-white shadow-xs ${isLoading ? 'opacity-50' : ''}`}
        >
          <Trash2 className="w-4 h-4" /> VACIAR BITÁCORA
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Statistics Widgets */}
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-label-caps">Registros Mostrados</p>
            <p className="text-sm font-bold text-[#0b1c30]">{logs.length} Operaciones</p>
          </div>
        </div>
        <div className="bg-[#f8f9ff] border border-blue-100 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 text-[#10B981] rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-label-caps">Sesión Protegida</p>
            <p className="text-xs font-bold text-[#004ddf] font-mono leading-none">Administrador</p>
          </div>
        </div>
      </div>

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
                <th className="p-3">Descripción Detalle de Operación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-sm">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 font-semibold animate-pulse">
                    Descargando registros desde Supabase...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                    Sin eventos coincidentes en los registros recientes.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-400 font-data-mono font-semibold white-space-nowrap">
                      [{formatAuditDate(item.fecha)}]
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-1.5 py-0.5 rounded font-sans font-bold text-[9px] uppercase border bg-slate-50 text-slate-700 border-slate-200">
                        {item.accion}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-mono text-[11px] font-bold">
                      {item.operador}
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
