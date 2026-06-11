import React, { useState, useEffect } from 'react';
import { UserRole, CRMRecord, Contact, AuditLog } from '../types';
import { 
  getSupabaseClient,
  testSupabaseConnection,
  loadFromSupabase,
  bulkUploadToSupabase,
  SUPABASE_SQL_INSTRUCTIONS,
  getResolvedCRMTableName,
  getResolvedContactsTableName,
  getResolvedAuditLogsTableName
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
    localStorage.setItem('verse_supabase_url', supabaseUrl);
  }, [supabaseUrl]);

  useEffect(() => {
    localStorage.setItem('verse_supabase_key', supabaseKey);
  }, [supabaseKey]);

  useEffect(() => {
    localStorage.setItem('verse_supabase_autosync', String(autoSync));
  }, [autoSync]);

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
      { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Módulo de persistencia Supabase inicializado.' }
    ];
  });
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isPullLoading, setIsPullLoading] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'DISCONNECTED' | 'PARTIAL' | 'CONNECTED'>('DISCONNECTED');
  const [tablesStatus, setTablesStatus] = useState({ records: false, contacts: false, logs: false });
  const [rawConnectionError, setRawConnectionError] = useState<any>(null);
  const [copiedError, setCopiedError] = useState(false);

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
      timestamp: new Date().toLocaleTimeString(),
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
        }
      } else {
        setConnStatus('DISCONNECTED');
        addLog(result.message, 'error');
        if (result.rawError) {
          setRawConnectionError(result.rawError);
          addLog(`DETALLE DEL ERROR (copiar esto): ${JSON.stringify(result.rawError, Object.getOwnPropertyNames(result.rawError), 2)}`, 'error');
          console.error("Supabase Raw Error:", result.rawError);
        }
      }
    } catch (err: any) {
      setConnStatus('DISCONNECTED');
      addLog(`Error de red o detalles: ${err.message}`, 'error');
    } finally {
      setIsTestLoading(false);
    }
  };

  // Auto-test on first mount to verify connection immediately
  useEffect(() => {
    if (supabaseUrl && supabaseKey && connStatus === 'DISCONNECTED') {
      handleTestConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePullFromSupabase = async () => {
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
    } finally {
      setIsPullLoading(false);
    }
  };

  const handlePushToSupabase = async () => {
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
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-850 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
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
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-850 outline-none font-mono"
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
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="sr-only peer"
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
                  disabled={isTestLoading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-1.5"
                >
                  {isTestLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-sky-400" />}
                  PROBAR CONEXIÓN
                </button>

                <button
                  type="button"
                  onClick={handlePushToSupabase}
                  disabled={isPushLoading || role === 'Solo Lectura'}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:bg-slate-400"
                >
                  {isPushLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-4 h-4" />}
                  SUBIR DATOS (PUSH)
                </button>
              </div>

              <button
                type="button"
                onClick={handlePullFromSupabase}
                disabled={isPullLoading || role === 'Solo Lectura'}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:bg-slate-400"
              >
                {isPullLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4.5 h-4.5" />}
                IMPORTAR DE SUPABASE (PULL / RESET)
              </button>
            </div>
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
                  { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Consola técnica limpia.' }
                ])}
                className="hover:text-white font-bold uppercase underline outline-none"
              >
                Limpiar logs
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
