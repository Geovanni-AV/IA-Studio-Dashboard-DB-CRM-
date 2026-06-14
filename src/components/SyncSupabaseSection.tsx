import React, { useState, useEffect } from 'react';
import { UserRole, CRMRecord, Contact, AuditLog } from '../types';
import { getMexicoCityTimeString } from '../dateUtils';
import { 
  getSupabaseClient,
  testSupabaseConnection,
  loadFromSupabase,
  bulkUploadToSupabase,
  SUPABASE_SQL_INSTRUCTIONS,
  getResolvedCRMTableName,
  getResolvedContactsTableName,
  getResolvedAuditLogsTableName,
  deleteCRMRecordsFromSupabase
} from '../supabaseService';
import { 
  Database,
  Terminal,
  RefreshCw,
  Key,
  Lock,
  AlertTriangle,
  PlayCircle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Copy,
  Check,
  Download,
  Upload,
  Layers,
  Users,
  ShieldCheck
} from 'lucide-react';

interface SyncSupabaseSectionProps {
  role: UserRole;
  records: CRMRecord[];
  contacts: Contact[];
  auditLogs: AuditLog[];
  onSyncComplete: (records: CRMRecord[], contacts: Contact[], auditLogs: AuditLog[]) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function SyncSupabaseSection({
  role,
  records,
  contacts,
  auditLogs,
  onSyncComplete,
  onShowAudit
}: SyncSupabaseSectionProps) {
  // Check if current user is the official infrastructure administrator (geovanni@verse-technology.com)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('verse_google_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.email || '';
      }
    } catch (e) {}
    return '';
  });

  useEffect(() => {
    const checkEmail = () => {
      try {
        const saved = localStorage.getItem('verse_google_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.email !== currentUserEmail) {
            setCurrentUserEmail(parsed?.email || '');
          }
        } else if (currentUserEmail) {
          setCurrentUserEmail('');
        }
      } catch (e) {}
    };

    const interval = setInterval(checkEmail, 1000);
    window.addEventListener('storage', checkEmail);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkEmail);
    };
  }, [currentUserEmail]);

  const isInfraAdmin = currentUserEmail.toLowerCase() === 'geovanni@verse-technology.com';

  // Config fields
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    const val = localStorage.getItem('verse_supabase_url');
    // If empty or it's the old fake, misplaced, or misspelled domain ('iqxwrfjd' vs 'iqxwrfjf')
    if (!val || val.includes('bkeyhvbr4b4eokigmdgftu') || val.includes('iqxwrfjdvixidsnfwja')) {
      return 'https://iqxwrfjfdvixidsnfwja.supabase.co';
    }
    return val;
  });
  
  const [supabaseKey, setSupabaseKey] = useState(() => {
    const val = localStorage.getItem('verse_supabase_key');
    // Check if empty or is the old fake key
    if (!val || val.startsWith('sb_secret_')) {
      // Use the anon key provided by the user for standard browser requests, rather than service_role (CORS reasons)
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg';
    }
    return val;
  });

  const [autoSync, setAutoSync] = useState(() => {
    const local = localStorage.getItem('verse_supabase_autosync');
    return local ? local === 'true' : true;
  });

  // Save values to localStorage
  useEffect(() => {
    if (isInfraAdmin) {
      localStorage.setItem('verse_supabase_url', supabaseUrl);
    }
  }, [supabaseUrl, isInfraAdmin]);

  useEffect(() => {
    if (isInfraAdmin) {
      localStorage.setItem('verse_supabase_key', supabaseKey);
    }
  }, [supabaseKey, isInfraAdmin]);

  useEffect(() => {
    if (isInfraAdmin) {
      localStorage.setItem('verse_supabase_autosync', String(autoSync));
    }
  }, [autoSync, isInfraAdmin]);

  // UI state
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<Array<{ timestamp: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }>>(() => {
    const local = localStorage.getItem('verse_supabase_sync_logs');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        // Fallback
      }
    }
    return [
      { timestamp: getMexicoCityTimeString(), type: 'info', message: 'Módulo de persistencia Supabase inicializado.' }
    ];
  });
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isPullLoading, setIsPullLoading] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'DISCONNECTED' | 'PARTIAL' | 'CONNECTED'>('DISCONNECTED');
  const [tablesStatus, setTablesStatus] = useState({ records: false, contacts: false, logs: false });
  const [rawConnectionError, setRawConnectionError] = useState<any>(null);
  const [copiedError, setCopiedError] = useState(false);

  // Duplicate records check states
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [duplicateList, setDuplicateList] = useState<CRMRecord[]>([]);
  const [cleanRecordsList, setCleanRecordsList] = useState<CRMRecord[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleInspectDuplicates = () => {
    // Group records by 'informacion_general_folio'
    const groups: Record<string, CRMRecord[]> = {};
    records.forEach((rec) => {
      const folio = rec.informacion_general_folio ? rec.informacion_general_folio.trim() : 'S/F';
      if (!groups[folio]) {
        groups[folio] = [];
      }
      groups[folio].push(rec);
    });

    const keep: CRMRecord[] = [];
    const dupes: CRMRecord[] = [];

    Object.entries(groups).forEach(([folio, group]) => {
      if (group.length <= 1) {
        keep.push(...group);
      } else {
        // Sort: latest fecha_registro first (newest kept canonical). If same, sort by ID
        const sorted = [...group].sort((a, b) => {
          const dateA = a.fecha_registro || '';
          const dateB = b.fecha_registro || '';
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA); // Newest first
          }
          return (b.id || '').localeCompare(a.id || '');
        });

        // The first one is canonical
        keep.push(sorted[0]);
        // Rest are duplicates
        dupes.push(...sorted.slice(1));
      }
    });

    setDuplicateList(dupes);
    setCleanRecordsList(keep);

    if (dupes.length === 0) {
      addLog('Escaneo de base de datos finalizado. No se encontraron registros duplicados de la columna informacion_general_folio.', 'success');
      alert('🔍 Diagnóstico Completado:\n\nNo se encontraron registros duplicados de la columna "informacion_general_folio" en la tabla DB CRM.');
      return;
    }

    setShowCleanupModal(true);
  };

  const handleExecuteCleanup = async () => {
    if (duplicateList.length === 0) {
      setShowCleanupModal(false);
      return;
    }

    setIsCleaning(true);
    addLog(`Iniciando depuración de ${duplicateList.length} registros duplicados de la tabla central de expedientes...`, 'info');

    try {
      let supabaseSuccess = true;
      let errorDetail = '';

      // If Supabase is connected, delete from table in batch
      const hasSupabaseConfig = supabaseUrl && supabaseKey;
      if (hasSupabaseConfig && connStatus === 'CONNECTED') {
        addLog(`Eliminando ${duplicateList.length} registros de forma remota en Supabase...`, 'info');
        const idsToDelete = duplicateList.map(d => d.id);
        const success = await deleteCRMRecordsFromSupabase(supabaseUrl, supabaseKey, idsToDelete);
        if (!success) {
          supabaseSuccess = false;
          errorDetail = 'Error al ejecutar query DELETE en la base de datos de Supabase.';
        }
      } else if (hasSupabaseConfig) {
        addLog('Aviso: Supabase está configurado pero no se detectó conexión exitosa. Se procede solo a depuración local.', 'warn');
      }

      if (supabaseSuccess) {
        // Update local React state elements (parent state update trigger)
        onSyncComplete(cleanRecordsList, contacts, auditLogs);
        
        // Audit telemetry insertion
        onShowAudit('DEPURACIÓN DUPLICADOS', `Eliminó con éxito ${duplicateList.length} registros duplicados redundantes de la columna de folios.`);
        addLog(`Depuración completada con éxito. Se eliminaron ${duplicateList.length} registros duplicados de folios de forma ${hasSupabaseConfig && connStatus === 'CONNECTED' ? 'local y remota' : 'local'}.`, 'success');
        
        alert(`¡Depuración exitosa!\n\nSe eliminaron correctamente ${duplicateList.length} registros duplicados de la columna "informacion_general_folio". El estado de la base de datos distribuida se encuentra perfectamente sincronizado.`);
      } else {
        addLog(`La depuración remota de Supabase falló: ${errorDetail}. Sincronización local abortada para conservar coherencia entre nodos.`, 'error');
        alert(`Error en depuración de base de datos remota: ${errorDetail}`);
      }
    } catch (err: any) {
      addLog(`Error fatal durante la depuración de duplicados: ${err.message}`, 'error');
      alert(`Ocurrió un error inesperado al eliminar registros redundantes: ${err.message}`);
    } finally {
      setIsCleaning(false);
      setShowCleanupModal(false);
    }
  };

  // Sync logs array state back to storage
  useEffect(() => {
    localStorage.setItem('verse_supabase_sync_logs', JSON.stringify(logs));
  }, [logs]);

  const handleCopyRawError = () => {
    if (!rawConnectionError) return;
    const errText = typeof rawConnectionError === 'object' 
      ? JSON.stringify(rawConnectionError, Object.getOwnPropertyNames(rawConnectionError), 2)
      : String(rawConnectionError);
    navigator.clipboard.writeText(errText);
    setCopiedError(true);
    setTimeout(() => setCopiedError(false), 2000);
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLogs((prev) => [...prev, {
      timestamp: getMexicoCityTimeString(),
      type,
      message
    }]);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_INSTRUCTIONS);
    setCopied(true);
    addLog('Código SQL de creación de tablas copiado al portapapeles.', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede comprobar la conexión con la base de datos Supabase.");
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      addLog('Error: Por favor complete la URL y la Key de Supabase antes de realizar pruebas.', 'error');
      return;
    }

    setIsTestLoading(true);
    addLog(`Comprobando comunicación con Supabase URL (${supabaseUrl.substring(0, 30)}...)...`, 'info');

    try {
      const result = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setTablesStatus(result.tablesDetected);

      if (result.success) {
        setRawConnectionError(null);
        const allConnected = result.tablesDetected.records && result.tablesDetected.contacts && result.tablesDetected.logs;
        if (allConnected) {
          setConnStatus('CONNECTED');
          addLog(result.message, 'success');
          onShowAudit('CONEXIÓN BASE DATOS', `Conexión exitosa a la base de datos Supabase completada sin errores.`);
        } else {
          setConnStatus('PARTIAL');
          addLog('Conexión establecida pero faltan tablas. Ejecute el script SQL provisto.', 'warn');
          onShowAudit('ANOMALÍA', `Conexión establecida con Supabase pero con estado parcial o tablas ausentes.`);
        }
      } else {
        setConnStatus('DISCONNECTED');
        addLog(result.message, 'error');
        onShowAudit('ERROR', `Fallo de conexión a Supabase: ${result.message}`);
        if (result.rawError) {
          setRawConnectionError(result.rawError);
          addLog(`DETALLE DEL ERROR (copiar esto): ${JSON.stringify(result.rawError, Object.getOwnPropertyNames(result.rawError), 2)}`, 'error');
          console.error("Supabase Raw Error:", result.rawError);
        }
      }
    } catch (err: any) {
      setConnStatus('DISCONNECTED');
      addLog(`Error de red o detalles: ${err.message}`, 'error');
      onShowAudit('ERROR', `Error crítico de red en puente de Supabase: ${err.message}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  // Auto-test on first mount to verify connection immediately (only if admin is logged in, else mock standard loading or initial fetch)
  useEffect(() => {
    if (supabaseUrl && supabaseKey && connStatus === 'DISCONNECTED') {
      if (isInfraAdmin) {
        handleTestConnection();
      } else {
        // Simple mock silent read of table metadata to keep standard UI status without throwing or alerting
        testSupabaseConnection(supabaseUrl, supabaseKey).then((result) => {
          setTablesStatus(result.tablesDetected);
          if (result.success) {
            setConnStatus(result.tablesDetected.records && result.tablesDetected.contacts && result.tablesDetected.logs ? 'CONNECTED' : 'PARTIAL');
          }
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInfraAdmin]);

  const handlePullFromSupabase = async () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede importar datos activos desde el puente de Supabase.");
      return;
    }

    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: Tu perfil "${role}" no tiene privilegios para realizar sincronizaciones de bajada.`);
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      addLog('Error: Configure las variables antes de importar.', 'error');
      return;
    }

    if (!window.confirm('¿Está seguro de importar datos de Supabase? Esto reemplazará los registros, contactos y bitácora de la sesión actual de tu navegador.')) {
      return;
    }

    setIsPullLoading(true);
    addLog('Iniciando descarga consolidada en tiempo real de Supabase...', 'info');

    try {
      const result = await loadFromSupabase(supabaseUrl, supabaseKey);
      if (result.success) {
        setRawConnectionError(null);
        if (result.records.length === 0) {
          addLog('Atención: La descarga de Supabase fue exitosa, pero las tablas en la nube están vacías. Puedes usar el botón "SUBIR DATOS (PUSH)" para poblar tu base de datos con los datos estándar y de demostración.', 'warn');
        }
        onSyncComplete(result.records, result.contacts, result.auditLogs);
        addLog(result.message, 'success');
        onShowAudit('RESTABLECIMIENTO', `Importación de bajada exitosa desde Supabase. ${result.records.length} expedientes cargados.`);
        alert('Estructura sincronizada con éxito.');
      } else {
        setConnStatus('DISCONNECTED');
        addLog(result.message, 'error');
        onShowAudit('ERROR', `Fallo al importar de la base de datos Supabase: ${result.message}`);
        if (result.rawError) {
          setRawConnectionError(result.rawError);
          addLog(`DETALLE DEL ERROR: ${JSON.stringify(result.rawError, Object.getOwnPropertyNames(result.rawError), 2)}`, 'error');
        } else {
          setRawConnectionError(result.message);
        }
        alert(`Fallo en sincronización: ${result.message}`);
      }
    } catch (err: any) {
      setConnStatus('DISCONNECTED');
      setRawConnectionError(err);
      addLog(`Error en importación de bajada: ${err.message}`, 'error');
      onShowAudit('ERROR', `Error crítico al descargar de Supabase: ${err.message}`);
    } finally {
      setIsPullLoading(false);
    }
  };

  const handlePushToSupabase = async () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede exportar datos activos hacia el puente de Supabase.");
      return;
    }

    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: Tu perfil "${role}" no tiene privilegios para realizar sincronizaciones de subida.`);
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      addLog('Error: Configure las variables antes de exportar.', 'error');
      return;
    }

    if (!window.confirm(`¿Deseas exportar la base de datos actual (${records.length} registros, ${contacts.length} contactos y ${auditLogs.length} logs) a Supabase?`)) {
      return;
    }

    setIsPushLoading(true);
    addLog('Ejecutando exportación masiva consolidada a Supabase...', 'info');

    try {
      const result = await bulkUploadToSupabase(supabaseUrl, supabaseKey, records, contacts, auditLogs);
      if (result.success) {
        setRawConnectionError(null);
        addLog(result.message, 'success');
        onShowAudit('CONEXIÓN HOJA', 'Exportación masiva de datos locales a tablas Supabase completada.');
        alert(result.message);
      } else {
        setConnStatus('DISCONNECTED');
        addLog(result.message, 'error');
        onShowAudit('ERROR', `Fallo al exportar base de datos a Supabase: ${result.message}`);
        if (result.rawError) {
          setRawConnectionError(result.rawError);
          addLog(`DETALLE DEL ERROR: ${JSON.stringify(result.rawError, Object.getOwnPropertyNames(result.rawError), 2)}`, 'error');
        } else {
          setRawConnectionError(result.message);
        }
        alert(`Error al guardar: ${result.message}`);
      }
    } catch (err: any) {
      setConnStatus('DISCONNECTED');
      setRawConnectionError(err);
      addLog(`Error en exportación masiva: ${err.message}`, 'error');
      onShowAudit('ERROR', `Error crítico al subir a Supabase: ${err.message}`);
    } finally {
      setIsPushLoading(false);
    }
  };

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400 font-bold';
      case 'warn':
        return 'text-amber-400 font-medium';
      case 'error':
        return 'text-red-400 font-extrabold animate-pulse';
      default:
        return 'text-sky-300';
    }
  };

  return (
    <div className="space-y-6 fade-in text-left">
      <div className="pb-2">
        <h1 className="text-2xl font-bold text-[#0b1c30] flex items-center gap-2">
          <Database className="text-blue-600 w-7 h-7" />
          Puente Cloud Supabase
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configura y automatiza la persistencia permanente con Supabase PostgreSQL. Almacena de forma unificada cotizaciones, expedientes comerciales, contactos y bitácoras técnicas de auditoría.
        </p>
      </div>

      {/* BANNERS DE CONTROL EXCLUSIVO DE INFRAESTRUCTURA DE SUPABASE */}
      {!isInfraAdmin ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Modo de Visualización Autorizado (Solo Lectura - Puente Cloud)</p>
            <p className="leading-relaxed font-medium">
              Panel de control de base de datos relacional integrado. Solo el Ingeniero Titular de infraestructura (<strong className="font-bold text-slate-900">geovanni@verse-technology.com</strong>) tiene facultades técnicas para testear configuraciones, editar secretos de API, re-establecer esquemas o detonar cargas/descargas en esta ventana.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Sesión Cloud del Administrador de Infraestructura Detectada</p>
            <p className="leading-relaxed font-medium">
              Bienvenido, <strong className="font-bold text-emerald-900">{currentUserEmail}</strong>. Tienes credenciales de lectura-escritura completas sobre las tablas Postgres, el router de sincronización automática y los disparadores de auditoría del backend.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        
        {/* Supabase parameters setup */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key className="text-blue-600 w-4.5 h-4.5" />
              Credenciales de Conexión
            </h3>

            {role === 'Solo Lectura' && (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-2.5 rounded text-xs flex items-center gap-1.5 font-medium">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Bloqueo del Rol Activo: Tu perfil es de Auditor (Solo Lectura) y no puede modificar ni subir datos a Supabase.</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                  SUPABASE PROJECT URL
                </label>
                <input
                  type="url"
                  placeholder="https://xyz-proyecto.supabase.co"
                  value={supabaseUrl}
                  disabled={!isInfraAdmin}
                  onChange={(e) => {
                    if (!isInfraAdmin) {
                      alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede editar las configuraciones de sincronización de Supabase.");
                      return;
                    }
                    setSupabaseUrl(e.target.value);
                  }}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-850 outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Copia la URL de tu panel de control de Supabase (Settings &gt; API).
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                  SUPABASE SERVICE_ROLE KEY o ANON KEY
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="sb_secret_..."
                    value={supabaseKey}
                    disabled={!isInfraAdmin}
                    onChange={(e) => {
                      if (!isInfraAdmin) {
                        alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede editar las configuraciones de sincronización de Supabase.");
                        return;
                      }
                      setSupabaseKey(e.target.value);
                    }}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-850 outline-none font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  {supabaseKey && (
                    <span className="absolute right-3 top-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 select-none">
                      PRE-CARGADO
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Clave de seguridad de base de datos provista por Verse Technology.
                </span>
              </div>

              {/* Toggle switch for AutoSync */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-lg">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800 text-xs">Sincronización Automática en Tiempo Real</p>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    Propagar de manera instantánea cualquier adición, edición o eliminación local a Supabase.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={autoSync} 
                    disabled={!isInfraAdmin}
                    onChange={(e) => {
                      if (!isInfraAdmin) {
                        alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede habilitar/deshabilitar la sincronización automática de Supabase.");
                        return;
                      }
                      setAutoSync(e.target.checked);
                    }}
                    className="sr-only peer disabled:cursor-not-allowed"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Status and Diagnostics */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                  <span>Diagnóstico de Tablas SQL</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    connStatus === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                    connStatus === 'PARTIAL' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {connStatus === 'CONNECTED' ? 'CONECTADO' : connStatus === 'PARTIAL' ? 'TABLAS FALTANTES' : 'OFFLINE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-[10px]">
                  <div className={`p-2 rounded border ${tablesStatus.records ? 'bg-emerald-50/45 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-100 border-slate-200 text-slate-450'}`}>
                    {getResolvedCRMTableName()}
                    <div className="text-[8px] mt-0.5 font-sans font-medium">{tablesStatus.records ? '✓ LISTO' : '✗ DETECT'}</div>
                  </div>
                  <div className={`p-2 rounded border ${tablesStatus.contacts ? 'bg-emerald-50/45 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-100 border-slate-200 text-slate-450'}`}>
                    {getResolvedContactsTableName()}
                    <div className="text-[8px] mt-0.5 font-sans font-medium">{tablesStatus.contacts ? '✓ LISTO' : '✗ DETECT'}</div>
                  </div>
                  <div className={`p-2 rounded border ${tablesStatus.logs ? 'bg-emerald-50/45 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-100 border-slate-200 text-slate-450'}`}>
                    {getResolvedAuditLogsTableName()}
                    <div className="text-[8px] mt-0.5 font-sans font-medium">{tablesStatus.logs ? '✓ LISTO' : '✗ DETECT'}</div>
                  </div>
                </div>
              </div>

              {rawConnectionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 mt-2 text-xs">
                  <div className="flex justify-between items-center text-red-800 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 font-sans">
                      <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
                      Detalle del Error
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRawError}
                      className="text-[9px] bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 font-bold px-2 py-0.5 rounded transition uppercase leading-none"
                    >
                      {copiedError ? '¡Copiado!' : 'Copiar de consola'}
                    </button>
                  </div>
                  <div className="bg-slate-900 text-rose-300 font-mono text-[10px] p-2 rounded-md overflow-x-auto max-h-[140px] leading-relaxed whitespace-pre scrollbar-thin">
                    {typeof rawConnectionError === 'object' 
                      ? JSON.stringify(rawConnectionError, Object.getOwnPropertyNames(rawConnectionError), 2)
                      : String(rawConnectionError)}
                  </div>
                  <div className="text-[10px] text-red-700 leading-normal font-sans">
                    💡 <strong>Diagnóstico:</strong> Este error responde al intento de fetch. Asegúrate de haber ejecutado el script SQL en el panel derecho para habilitar tablas y políticas CORS/RLS en Supabase.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestLoading || !isInfraAdmin}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isTestLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-sky-400" />}
                  PROBAR CONEXIÓN
                </button>

                <button
                  type="button"
                  onClick={handlePushToSupabase}
                  disabled={isPushLoading || role === 'Solo Lectura' || !isInfraAdmin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isPushLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-4 h-4" />}
                  SUBIR DATOS (PUSH)
                </button>
              </div>

              <button
                type="button"
                onClick={handlePullFromSupabase}
                disabled={isPullLoading || role === 'Solo Lectura' || !isInfraAdmin}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {isPullLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4.5 h-4.5" />}
                IMPORTAR DE SUPABASE (PULL / RESET)
              </button>
            </div>
          </div>

          {/* HERRAMIENTA DE DEPURACIÓN DE REGISTROS DUPLICADOS (Rol Admin único) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldCheck className="text-amber-600 w-4.5 h-4.5" />
              Mantenimiento & Depuración de Duplicados
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta sección de auditoría avanzada escanea la base de datos comercial para identificar registros redundantes en base al <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">informacion_general_folio</code> de la tabla DB CRM. Al depurar, mantendremos el registro más reciente y purgaremos las copias redundantes.
            </p>

            {role !== 'Admin' ? (
              <div className="bg-amber-50 text-amber-900 border border-amber-100 p-3 rounded-lg text-xs flex items-center gap-2 font-medium leading-relaxed">
                <Lock className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                <span>Bloqueo del Rol Activo: Tu perfil es "{role}". Solo los usuarios con rol de Administrador ("Admin") tienen privilegios para depurar duplicados de folios.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-50 text-emerald-950 p-3 rounded-lg text-xs flex items-start gap-2 border border-emerald-150 font-medium leading-relaxed">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Acceso Permitido:</span> Tienes credenciales de Administrador para analizar y purgar la consistencia de folios.
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleInspectDuplicates}
                  className="w-full bg-[#d97706] hover:bg-[#b45309] text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-2 text-xs shadow-sm cursor-pointer border border-[#c2410c]"
                >
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-200 animate-pulse" />
                  ANALIZAR Y ELIMINAR DUPLICADOS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Process Logs Terminal & SQL Instructions */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full space-y-4">
          
          {/* SQL Editor script box */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <Database className="text-emerald-600 w-4.5 h-4.5" />
                  Script de Creación de Tablas SQL
                </h3>
                <button
                  onClick={handleCopySQL}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal mb-1.5">
                Copia este script e introdúcelo en el <strong>SQL Editor</strong> de tu panel de Supabase para inicializar las tablas de forma automática con un click.
              </p>
            </div>

            <div className="flex-1 rounded-lg border border-slate-200 bg-slate-950 p-3 h-48 overflow-y-auto">
              <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre text-left select-all leading-normal">
                {SUPABASE_SQL_INSTRUCTIONS}
              </pre>
            </div>
          </div>

          {/* Connection Console */}
          <div className="bg-[#0b1c30] border border-[#1e2d3e] rounded-lg p-4 flex flex-col justify-between shadow-lg h-56">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="text-sky-400 w-4 h-4 animate-pulse" />
                <span className="font-bold text-sky-400 text-[10px] tracking-widest font-mono">
                  PUENTE SUPABASE CONSOLE
                </span>
              </div>
              <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-900 font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                SUPABASE SYNC
              </span>
            </div>

            <div className="flex-1 bg-black/40 p-3 rounded border border-white/5 font-mono text-[10px] leading-relaxed space-y-1 max-h-[120px] overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-1.5 items-start">
                  <span className="text-slate-500 font-bold whitespace-nowrap">[{log.timestamp}]</span>
                  <span className={`${getLogStyle(log.type)}`}>
                    {log.type.toUpperCase()}:
                  </span>
                  <span className="text-slate-200 font-medium font-sans">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-400">
              <span className="uppercase text-slate-400">Sincronización: {autoSync ? 'Automática Activa' : 'Manual'}</span>
              <button
                onClick={() => setLogs([
                  { timestamp: getMexicoCityTimeString(), type: 'info', message: 'Consola técnica limpia.' }
                ])}
                className="hover:text-white font-bold uppercase underline outline-none"
              >
                Limpiar logs
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN Y RESUMEN DE DEPURACIÓN (VENTANA EMERGENTE COGNITIVA) */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden transform transition-all animate-scale-up">
            
            {/* Header del modal */}
            <div className="bg-[#0b1c30] text-white px-5 py-4 flex items-center justify-between border-b border-[#1e2d3e]">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="text-amber-400 w-5 h-5 animate-pulse" />
                <span className="font-title-sm text-base font-bold tracking-tight">
                  Resumen de Duplicados Detectados
                </span>
              </div>
              <button
                onClick={() => setShowCleanupModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase underline"
              >
                Cerrar
              </button>
            </div>

            {/* Contenido principal del modal */}
            <div className="p-5 space-y-4 text-left">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-950 flex gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">¡Atención! Acción de depuración irreversible.</p>
                  <p className="leading-relaxed">
                    Se detectaron <strong className="font-extrabold text-amber-900">{duplicateList.length} registros duplicados</strong> (copias antiguas que comparten el mismo folio en la base de datos). El algoritmo seleccionó la versión más reciente de cada folio para mantenerla activa y purgará el resto.
                  </p>
                </div>
              </div>

              {/* Detalle visual de folios e identificadores duplicados */}
              <div className="space-y-2">
                <p className="text-xs uppercase font-bold tracking-wider text-slate-500 font-mono">
                  Registros que se van a eliminar ({duplicateList.length})
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-3 text-xs divide-y divide-slate-100 scrollbar-thin">
                  {duplicateList.map((rec, idx) => {
                    return (
                      <div key={rec.id} className="py-2 flex justify-between items-center bg-transparent">
                        <div className="space-y-0.5">
                          <p className="font-mono text-slate-900 font-semibold text-[11px]">
                            {idx + 1}. Folio No: <span className="bg-amber-100 px-1 py-0.2 rounded text-amber-900 font-bold">{rec.informacion_general_folio}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-sans leading-tight">
                            Cliente: <strong className="text-slate-700">{rec.informacion_general_cliente}</strong> | Proyecto: {rec.informacion_general_proyecto}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className="font-mono text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            {rec.fecha_registro}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Indicador de conexión / afectación de Supabase */}
              {supabaseUrl && supabaseKey && connStatus === 'CONNECTED' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-[11px] text-blue-900 flex items-center gap-2">
                  <Database className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                  <span>
                    <strong>Puente Supabase Activado:</strong> Los {duplicateList.length} duplicados también serán eliminados de la base de datos remota de Supabase <strong className="font-mono">{getResolvedCRMTableName()}</strong>.
                  </span>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 text-[11px] text-slate-600 flex items-center gap-2">
                  <Database className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  <span>
                    La depuración solo se aplicará al almacenamiento local (o Supabase no tiene comunicación activa en este momento).
                  </span>
                </div>
              )}
            </div>

            {/* Footer con controles finales */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium py-2 px-4 rounded-lg text-xs transition"
              >
                CANCELAR
              </button>
              
              <button
                type="button"
                disabled={isCleaning}
                onClick={handleExecuteCleanup}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition flex items-center gap-2 shadow-xs cursor-pointer border border-red-700 disabled:opacity-50"
              >
                {isCleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                CONFIRMAR Y PURGAR ({duplicateList.length})
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
