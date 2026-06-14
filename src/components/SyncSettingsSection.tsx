import React, { useState, useEffect } from 'react';
import { UserRole, CRMRecord } from '../types';
import { getMexicoCityTimeString } from '../dateUtils';
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
    if (isInfraAdmin) {
      localStorage.setItem('verse_sheet_url', sheetUrl);
    }
  }, [sheetUrl, isInfraAdmin]);

  useEffect(() => {
    if (isInfraAdmin) {
      localStorage.setItem('verse_sheet_api_key', apiKey);
    }
  }, [apiKey, isInfraAdmin]);

  useEffect(() => {
    if (isInfraAdmin) {
      localStorage.setItem('verse_sheet_token', token);
    }
  }, [token, isInfraAdmin]);

  // OAuth Client Information matching the provided credentials
  const clientId = '769103708552-r9ljosbra9hp8bk4l5sgm8h3j4mt77ii.apps.googleusercontent.com';
  const clientSecret = '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';

  // Process Logs
  const [logs, setLogs] = useState<SyncLog[]>([
    { timestamp: getMexicoCityTimeString(), type: 'info', message: 'Sistema de sincronización de Google Sheets inicializado.' },
    { timestamp: getMexicoCityTimeString(), type: 'success', message: 'Configuración de OAuth predefinida con Google Auth Platform.' }
  ]);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncWithToken = async (overrideToken?: string) => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede ejecutar la sincronización activa con Google Sheets.");
      return;
    }

    if (role !== 'Admin') {
      alert(`Acceso denegado: El perfil con rol "${role}" no tiene privilegios de Administrador para realizar sincronizaciones con Google Sheets. Solo el rol "Admin" puede ejecutar esta acción de forma manual.`);
      return;
    }

    // Primera confirmación
    const confirm1 = window.confirm("¿Está seguro de que desea sincronizar los datos de Google Sheets de forma manual? (Confirmación 1/2)");
    if (!confirm1) {
      setLogs((prev) => [...prev, {
        timestamp: getMexicoCityTimeString(),
        type: 'warn',
        message: 'Sincronización manual cancelada por el usuario en la primera confirmación.'
      }]);
      return;
    }

    // Segunda confirmación
    const confirm2 = window.confirm("¿Confirma por segunda vez que desea sobreescribir la consistencia de datos de la base de datos distribuida con la información remota de Google Sheets? (Confirmación 2/2)");
    if (!confirm2) {
      setLogs((prev) => [...prev, {
        timestamp: getMexicoCityTimeString(),
        type: 'warn',
        message: 'Sincronización manual cancelada por el usuario en la segunda confirmación.'
      }]);
      return;
    }

    setIsSyncing(true);
    setLogs((prev) => [...prev, {
      timestamp: getMexicoCityTimeString(),
      type: 'info',
      message: 'Comandando transmisión de datos manual con Google Sheets...'
    }]);

    const activeToken = overrideToken !== undefined ? overrideToken : token;
    const result = await syncFromGoogleSheets(sheetUrl, apiKey, activeToken);
    setLogs((prev) => [...prev, ...result.logs]);
    
    setIsSyncing(false);

    if (result.success) {
      onSyncComplete(result.logs, result.records);
      onShowAudit('CONEXIÓN HOJA', `Sincronizó exitosamente base de datos con Google Sheets URL: ${sheetUrl.substring(0, 45)}...`);
    } else {
      onShowAudit('ERROR', `Fallo de sincronización manual con Google Sheets.`);
    }
  };

  // Secure message listener for receive OAuth Token from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate origin matches current site
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_SHEETS_TOKEN' && event.data?.token) {
        if (!isInfraAdmin) {
          setLogs((prev) => [...prev, {
            timestamp: getMexicoCityTimeString(),
            type: 'error',
            message: 'Intento de vinculación web bloqueado: Token recibido pero el usuario activo no es el administrador de infraestructura.'
          }]);
          onShowAudit('ANOMALÍA', 'Intento desactivado de vincular token OAuth de Google Sheets sin ser administrador de infraestructura.');
          return;
        }

        if (role !== 'Admin') {
          setLogs((prev) => [...prev, {
            timestamp: getMexicoCityTimeString(),
            type: 'error',
            message: 'Acceso denegado: Se requiere rol de Administrador ("Admin") para la vinculación manual de datos.'
          }]);
          onShowAudit('ANOMALÍA', 'Intento desactivado de vincular token OAuth de Google Sheets con rol insuficiente.');
          return;
        }

        setToken(event.data.token);
        setLogs((prev) => [...prev, {
          timestamp: getMexicoCityTimeString(),
          type: 'success',
          message: '¡Conexión autorizada! Token de Acceso OAuth recibido exitosamente de Google.'
        }]);
        // Trigger automated sync immediately with the newly acquired token (will ask for double confirm!)
        handleSyncWithToken(event.data.token);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [sheetUrl, apiKey, role, token, isInfraAdmin]);

  const handleOAuthLogin = () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede autorizar nuevas credenciales de Google OAuth.");
      return;
    }

    if (role !== 'Admin') {
      alert(`Acceso denegado: El perfil con rol "${role}" no tiene privilegios de Administrador para realizar vinculaciones o conexiones de datos. Solo el rol "Admin" puede realizar la vinculación.`);
      return;
    }

    const redirectUri = window.location.origin;
    // Request Google Sheets, Drive, and User Profile metadata scopes for identity retrieval
    const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid';
    
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
        timestamp: getMexicoCityTimeString(),
        type: 'info',
        message: 'Portal de consentimiento abierto. Esperando autorización segura del usuario en Google...'
      }]);
    }
  };

  const handleSyncNow = async () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede ejecutar la sincronización activa con Google Sheets.");
      return;
    }

    if (role !== 'Admin') {
      alert(`🔒 Acción Restringida: Sincronización manual solo permitida para el rol de Administrador ("Admin").`);
      return;
    }

    await handleSyncWithToken();
  };

  const handleReset = () => {
    if (!isInfraAdmin) {
      alert("🔒 Acción restringida: Solo el usuario titular de la infraestructura (geovanni@verse-technology.com) puede realizar el restablecimiento administrativo de prueba local.");
      return;
    }

    if (role !== 'Admin') {
      alert(`🔒 Acción Restringida: Solo el rol de Administrador ("Admin") está facultado para restaurar la persistencia de prueba local.`);
      return;
    }

    if (window.confirm('¿Está seguro de que desea restablecer la base de datos? Se perderán las modificaciones locales y se regresará a los 5 expedientes estándar (Grupo Bimbo, AstraZeneca y UNAM).')) {
      onResetDatabase();
      onShowAudit('RESTABLECIMIENTO', 'Reestableció la base de datos local a valores estándar de prueba.');
      
      setLogs((prev) => [...prev, {
        timestamp: getMexicoCityTimeString(),
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

      {/* BANNERS DE CONTROL EXCLUSIVO DE INFRAESTRUCTURA */}
      {!isInfraAdmin ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Modo de Visualización Autorizado (Solo Lectura)</p>
            <p className="leading-relaxed font-medium">
              Estás visualizando el panel de control de Google Sheets. Solo el Ingeniero Titular administrador de infraestructura (<strong className="font-bold text-slate-900">geovanni@verse-technology.com</strong>) tiene facultades de escritura, cambio de credenciales, cambio de logos y sincronización activa para esta ventana.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Sesión Titular de Infraestructura Detectada</p>
            <p className="leading-relaxed font-medium">
              Bienvenido, <strong className="font-bold text-emerald-900">{currentUserEmail}</strong>. Tienes privilegios administrativos completos para reconfigurar credenciales, sincronizar bases de datos comerciales de forma manual y reestablecer cachés.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Connection Setup card */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key className="text-blue-600 w-4.5 h-4.5" />
              Credenciales Google Auth Platform
            </h3>

            {role !== 'Admin' && (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-2.5 rounded text-xs flex items-center gap-1.5 animate-pulse">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Bloqueo del Rol Activo: Tu rol es "{role}". Se requiere Rol de Administrador ("Admin") para la sincronización manual de Google Sheets.</span>
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
                disabled={role !== 'Admin' || !isInfraAdmin}
                className={`w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-lg border border-slate-950 transition-all flex justify-center items-center gap-2.5 text-xs shadow-3xs ${
                  role !== 'Admin' || !isInfraAdmin ? 'opacity-50 cursor-not-allowed bg-slate-400 border-none' : ''
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
                  disabled={!isInfraAdmin}
                  onChange={(e) => {
                    if (!isInfraAdmin) {
                      alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede editar las configuraciones de sincronización.");
                      return;
                    }
                    setSheetUrl(e.target.value);
                  }}
                  className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                    disabled={!isInfraAdmin}
                    onChange={(e) => {
                      if (!isInfraAdmin) {
                        alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede editar las configuraciones de sincronización.");
                        return;
                      }
                      setToken(e.target.value);
                    }}
                    className="text-xs w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-855 outline-none font-mono disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={!isInfraAdmin}
                  onChange={(e) => {
                    if (!isInfraAdmin) {
                      alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede editar las configuraciones de sincronización.");
                      return;
                    }
                    setApiKey(e.target.value);
                  }}
                  className="text-xs w-full bg-slate-100 border border-slate-200 p-2 rounded-lg text-slate-800 outline-none font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing || role !== 'Admin' || !isInfraAdmin}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-1.5 shadow-3xs ${
                  isSyncing || role !== 'Admin' || !isInfraAdmin ? 'opacity-55 cursor-not-allowed bg-slate-400' : ''
                }`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4.5 h-4.5" />
                )}
                SINCRO HOJAS LIVE COGNITIVA (MANUAL)
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
              disabled={role !== 'Admin' || !isInfraAdmin}
              className={`w-full font-bold text-xs py-2.5 rounded transition-colors flex justify-center items-center gap-1.5 ${
                role === 'Admin' && isInfraAdmin
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {(role !== 'Admin' || !isInfraAdmin) && <Lock className="w-3.5 h-3.5" />}
              RESTABLECER VALORES ESTÁNDAR
            </button>
          </div>

          {/* Módulo de Auditoría de Identidad: Gestión del Logo Oficial de Verse Technology */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-title-sm text-base font-semibold text-[#0b1c30] flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sparkles className="text-blue-600 w-4.5 h-4.5 animate-pulse" />
              Identidad Corporativa y Logo Oficial
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Auditoría del logo: Administra el identificador visual de <strong>Verse Technology</strong>. El logo se sincronizará de forma automática y unificada en la barra superior de seguridad y en todos los formularios interactivos de exportación y cotizaciones.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2">
              <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">Formatos recomendados para compartir:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11.5px] pl-1 font-sans">
                <li><strong className="text-slate-900 font-semibold">SVG Vectorial (.svg) [Altamente recomendado]:</strong> Ideal para un escalado nítido basado en curvas matemáticas en pantallas Retina.</li>
                <li><strong className="text-slate-900 font-semibold">PNG con transparencia (.png):</strong> Resolución sugerida de min. 128x128 píxeles con fondo transparente.</li>
                <li><strong className="text-slate-900 font-semibold">JPG de alta densidad (.jpg/.jpeg):</strong> Imagen limpia y centrada con relación de aspecto cuadrada.</li>
              </ul>
            </div>

            {/* Logo Customizer controls */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="w-12 h-12 flex-shrink-0 bg-slate-800 rounded flex items-center justify-center p-2 border border-slate-700">
                  {localStorage.getItem('verse_custom_logo') ? (
                    <img 
                      src={localStorage.getItem('verse_custom_logo') || ''} 
                      alt="Logo Oficial Preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <svg viewBox="0 0 100 100" className="w-10 h-10 select-none rounded shadow-sm overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                      <rect width="100" height="100" fill="#2f67ff" />
                      <text x="52" y="52" fill="white" fontSize="68" fontWeight="800" fontFamily='"Outfit", "Inter", "Space Grotesk", sans-serif' textAnchor="middle" dominantBaseline="central">T</text>
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-[10px] text-green-400 font-mono font-bold tracking-widest uppercase block mb-0.5">Vista previa en producción</span>
                  <span className="text-xs text-slate-200 font-semibold leading-none">
                    {localStorage.getItem('verse_custom_logo') ? 'Logo oficial personalizado de Verse' : 'Logo Vectorial Oficial (Por Defecto)'}
                  </span>
                </div>
              </div>

              {/* Upload controls */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                  Cargar nuevo logo corporativo (Archivo local o Drag-and-drop)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg"
                    disabled={!isInfraAdmin}
                    onChange={(e) => {
                      if (!isInfraAdmin) {
                        alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede cambiar el logo oficial.");
                        return;
                      }
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          localStorage.setItem('verse_custom_logo', base64String);
                          window.dispatchEvent(new Event('storage'));
                          // Force local render update
                          alert('¡Logo oficial cargado e incorporado con éxito de forma unificada!');
                          window.location.reload();
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-xs text-slate-500
                      file:mr-3 file:py-1.5 file:px-3
                      file:rounded-md file:border-0
                      file:text-xs file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* URL Customizer controls */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                  O vincular vía URL de imagen pública
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="logo_url_input"
                    placeholder="https://ejemplo.com/logo-oficial.svg"
                    disabled={!isInfraAdmin}
                    className="text-xs flex-1 bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!isInfraAdmin) {
                          alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede cambiar el logo oficial.");
                          return;
                        }
                        const target = e.currentTarget;
                        if (target.value.trim()) {
                          localStorage.setItem('verse_custom_logo', target.value.trim());
                          window.dispatchEvent(new Event('storage'));
                          alert('¡Logo cargado mediante URL exitosamente!');
                          window.location.reload();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!isInfraAdmin) {
                        alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede cambiar el logo oficial.");
                        return;
                      }
                      const input = document.getElementById('logo_url_input') as HTMLInputElement | null;
                      if (input && input.value.trim()) {
                        localStorage.setItem('verse_custom_logo', input.value.trim());
                        window.dispatchEvent(new Event('storage'));
                        alert('¡Logo cargado mediante URL exitosamente!');
                        window.location.reload();
                      }
                    }}
                    disabled={!isInfraAdmin}
                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    Vincular
                  </button>
                </div>
              </div>

              {localStorage.getItem('verse_custom_logo') && (
                <button
                  onClick={() => {
                    if (!isInfraAdmin) {
                      alert("🔒 Modificación restringida: Solo el usuario titular (geovanni@verse-technology.com) puede cambiar el logo oficial.");
                      return;
                    }
                    if (window.confirm('¿Desea restablecer el logo por defecto oficial de Verse?')) {
                      localStorage.removeItem('verse_custom_logo');
                      window.dispatchEvent(new Event('storage'));
                      window.location.reload();
                    }
                  }}
                  className="w-full text-center text-red-500 hover:text-red-600 font-bold text-xs py-1 mt-1 block disabled:text-slate-400"
                  disabled={!isInfraAdmin}
                >
                  Restablecer logo oficial por defecto
                </button>
              )}
            </div>
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
                  { timestamp: getMexicoCityTimeString(), type: 'info', message: 'Consola técnica limpia.' }
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
