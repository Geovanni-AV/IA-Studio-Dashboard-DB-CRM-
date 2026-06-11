import React, { useState, useEffect } from 'react';
import { UserRole, CRMRecord } from '../types';
import { syncFromGoogleSheets, SyncLog } from '../googleSheetsService';
import { 
  Database, 
  Terminal, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Key, 
  Lock, 
  AlertTriangle, 
  PlayCircle,
  Chrome,
  CheckCircle,
  HelpCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface SyncSettingsSectionProps {
  role: UserRole;
  onResetDatabase: () => void;
  onSyncComplete: (logs: SyncLog[], records?: CRMRecord[]) => void;
  onShowAudit: (action: string, details: string) => void;
}

export default function SyncSettingsSection({
  role,
  onResetDatabase,
  onSyncComplete,
  onShowAudit
}: SyncSettingsSectionProps) {
  // Config fields
  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('verse_sheet_url') || 'https://docs.google.com/spreadsheets/d/1O0K6_E-zB8W8GzOq34AUnm5S-qY30hZ2p_T87152B3A/edit';
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('verse_sheet_api_key') || '';
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('verse_sheet_token') || '';
  });

  useEffect(() => {
    localStorage.setItem('verse_sheet_url', sheetUrl);
  }, [sheetUrl]);

  useEffect(() => {
    localStorage.setItem('verse_sheet_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('verse_sheet_token', token);
  }, [token]);

  // OAuth Client Information matching the provided credentials
  const clientId = '769103708552-r9ljosbra9hp8bk4l5sgm8h3j4mt77ii.apps.googleusercontent.com';
  const clientSecret = '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';

  // Process Logs
  const [logs, setLogs] = useState<SyncLog[]>([
    { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Sistema de sincronización de Google Sheets inicializado.' },
    { timestamp: new Date().toLocaleTimeString(), type: 'success', message: 'Configuración de OAuth predefinida con Google Auth Platform.' }
  ]);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncWithToken = async (overrideToken?: string) => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para iniciar sincronizaciones bilaterales.`);
      return;
    }

    setIsSyncing(true);
    setLogs((prev) => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Comandando transmisión de datos con Google Sheets...'
    }]);

    const activeToken = overrideToken !== undefined ? overrideToken : token;
    const result = await syncFromGoogleSheets(sheetUrl, apiKey, activeToken);
    setLogs((prev) => [...prev, ...result.logs]);
    
    setIsSyncing(false);

    if (result.success) {
      onSyncComplete(result.logs, result.records);
      onShowAudit('CONEXIÓN HOJA', `Sincronizó exitosamente base de datos con Google Sheets URL: ${sheetUrl.substring(0, 45)}...`);
    }
  };

  // Secure message listener for receive OAuth Token from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate origin matches current site
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_SHEETS_TOKEN' && event.data?.token) {
        setToken(event.data.token);
        setLogs((prev) => [...prev, {
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          message: '¡Conexión autorizada! Token de Acceso OAuth recibido exitosamente de Google.'
        }]);
        // Trigger automated sync immediately with the newly acquired token
        handleSyncWithToken(event.data.token);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [sheetUrl, apiKey, role, token]);

  const handleOAuthLogin = () => {
    if (role === 'Solo Lectura') {
      alert(`Acceso denegado: El perfil "${role}" no tiene privilegios para realizar conexiones de datos.`);
      return;
    }

    const redirectUri = window.location.origin;
    // Request Google Sheets and Drive metadata scopes
    const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&state=sheets_sync`;
    
    // Calculate central position for standard browser popup
    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      oauthUrl,
      'google_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
    );
    
    if (!popup) {
      alert('El navegador bloqueó la ventana emergente. Por favor, permita las ventanas emergentes para este portal para completar el consentimiento de Google.');
    } else {
      setLogs((prev) => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'Portal de consentimiento abierto. Esperando autorización segura del usuario en Google...'
      }]);
    }
  };

  const handleSyncNow = async () => {
    await handleSyncWithToken();
  };

  const handleReset = () => {
    if (role !== 'Admin') {
      alert(`🔒 Acción Restringida: Solo el rol de Administrador ("Admin") está facultado para restaurar la persistencia de prueba local.`);
      return;
    }

    if (window.confirm('¿Está seguro de que desea restablecer la base de datos? Se perderán las modificaciones locales y se regresará a los 5 expedientes estándar (Grupo Bimbo, AstraZeneca y UNAM).')) {
      onResetDatabase();
      onShowAudit('RESTABLECIMIENTO', 'Reestableció la base de datos local a valores estándar de prueba.');
      
      setLogs((prev) => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        message: 'Base de datos de persistencia local revertida de manera segura al estado estándar (Grupo Bimbo, AstraZeneca, UNAM).'
      }]);
      alert('Base de datos restablecida correctamente a sus valores de fábrica.');
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
        <h1 className="text-2xl font-bold text-[#0b1c30]">Canal Integrado Sheets Live</h1>
        <p className="text-sm text-slate-500 mt-1">
          Vincula y gestiona en tiempo real la consistencia de datos de tu CRM comercial con hojas de cálculo utilizando tus credenciales autorizadas de Google Cloud Platform.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Connection Setup card */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key className="text-blue-600 w-4.5 h-4.5" />
              Credenciales Google Auth Platform
            </h3>

            {role === 'Solo Lectura' && (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-2.5 rounded text-xs flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Bloqueo del Rol Activo: Tienes privilegios reducidos. No puedes detonar la sincronización.</span>
              </div>
            )}

            {/* Informative credentials status */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <span>Aplicación Registrada</span>
                <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> ACTIVA
                </span>
              </div>
              <p className="text-slate-700 font-medium text-[11px] leading-relaxed">
                Asociada al ID de cliente del proyecto de Google Cloud <strong className="font-semibold text-slate-900">gen-lang-client-0064582839</strong>.
              </p>
              <div className="pt-1.5 border-t border-slate-200/65 font-mono text-[10px] text-slate-500 space-y-1">
                <div><span className="font-semibold select-all text-slate-700">Client ID:</span> {clientId.substring(0, 45)}...</div>
                <div><span className="font-semibold select-all text-slate-700">Client Secret:</span> GOCSPX-H_...8Mu</div>
              </div>
            </div>

            {/* ACTION OAUTH LOGIN TRIGGER */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOAuthLogin}
                disabled={role === 'Solo Lectura'}
                className={`w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-lg border border-slate-950 transition-all flex justify-center items-center gap-2.5 text-xs shadow-3xs ${
                  role === 'Solo Lectura' ? 'opacity-50 cursor-not-allowed bg-slate-400 border-none' : ''
                }`}
              >
                <Chrome className="w-4.5 h-4.5 text-blue-400 animate-pulse" />
                AUTORIZAR ACCESO CON GOOGLE OAUTH 2.0
              </button>
              <p className="text-[10px] text-slate-500 leading-normal text-center">
                Esto generará un token temporal de lectura-escritura seguro para comunicar con tus hojas de cálculo en tiempo real.
              </p>
            </div>

            <div className="space-y-3 text-xs pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                  Enlace HTTPS o ID de tu Google Sheet*
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/S_ID/edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                  Token temporal OAuth (Autocompletado)*
                </label>
                <div className="relative">
                  <input
                    type={token ? "password" : "text"}
                    placeholder="Generado automáticamente al autorizar arriba..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-850 outline-none font-mono"
                  />
                  {token && (
                    <span className="absolute right-3 top-2.5 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-bounce">
                      <Sparkles className="w-2.5 h-2.5" /> CARGADO
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#555660] uppercase tracking-wider mb-1 px-0.2 font-label-caps">
                  Google Developer API Key (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSyA..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="text-xs w-full bg-slate-100 border border-slate-200 p-2 rounded-lg text-slate-800 outline-none font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing || role === 'Solo Lectura'}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-1.5 shadow-3xs ${
                  isSyncing || role === 'Solo Lectura' ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4.5 h-4.5" />
                )}
                SINCRO HOJAS LIVE COGNITIVA
              </button>
            </div>
          </div>

          {/* Admin panel / Reset block */}
          <div className="bg-red-50/20 border border-red-200 rounded-lg p-5 space-y-3.5">
            <h4 className="font-semibold text-sm text-red-950 flex items-center gap-1.5 font-title-sm">
              <Database className="text-red-600 w-4.5 h-4.5" />
              Restablecimiento Administrativo del Sandbox
            </h4>
            <p className="text-xs text-red-800 leading-relaxed font-medium">
              Opción avanzada utilizada por Carlos o coordinadores B2B para purgar la memoria local de su navegador y restablecer las cuentas de prueba originales ligadas a los contratos de <strong>Grupo Bimbo</strong>, <strong>AstraZeneca</strong> y la <strong>UNAM</strong>.
            </p>

            <button
              onClick={handleReset}
              disabled={role !== 'Admin'}
              className={`w-full font-bold text-xs py-2.5 rounded transition-colors flex justify-center items-center gap-1.5 ${
                role === 'Admin'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {role !== 'Admin' && <Lock className="w-3.5 h-3.5" />}
              RESTABLECER VALORES ESTÁNDAR
            </button>
          </div>
        </div>

        {/* Process Logs Terminal */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full space-y-2">
          <div className="bg-[#0b1c30] border border-[#1e2d3e] rounded-lg p-4 flex-1 flex flex-col justify-between shadow-lg min-h-[420px]">
            <div className="flex justify-between items-center pb-2.5 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="text-sky-400 w-5 h-5 animate-pulse" />
                <span className="font-bold text-sky-400 text-xs tracking-widest font-mono">
                  CONSOLA DE PROCESO DE CONTROL
                </span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                PORT: 3000 SYNC
              </span>
            </div>

            {/* Scrollable logs */}
            <div className="flex-1 bg-black/40 p-4 rounded border border-white/5 font-mono text-[11px] leading-relaxed select-text space-y-1.5 max-h-[360px] overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2 items-start">
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

            <div className="mt-3.5 pt-3 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-400">
              <span>ESTADO CONEXIÓN: {token ? 'AUTORIZADO (LIVE)' : 'LISTO'}</span>
              <button
                onClick={() => setLogs([
                  { timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Consola técnica limpia.' }
                ])}
                className="hover:text-white font-bold tracking-wider uppercase underline outline-none font-mono"
              >
                Limpiar Logs
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Reestructuración Técnica de IVA (16% Obligatorio):</p>
              <p className="font-medium">
                La plataforma de Verse CRM aplica de forma incondicional un cálculo de 16% de Impuesto al Valor Agregado en todas las transacciones procesadas, previniendo discrepancias con auditorías fiscales locales del SAT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
