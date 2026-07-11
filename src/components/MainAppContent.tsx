import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useData } from '../contexts/DataContext';
import { PresenceContext } from '../contexts/PresenceContext';
import { motion } from 'motion/react';
import { CRMRecord, Contact, AuditLog, UserRole, UserAccount, PurchaseOrder } from '../types';
import { INITIAL_RECORDS, INITIAL_CONTACTS, INITIAL_AUDIT_LOGS } from '../mockData';
import { getMexicoCityDateTimeString, getMexicoCityTimeString } from '../dateUtils';
import { 
  pushCRMRecordToSupabase, 
  deleteCRMRecordFromSupabase, 
  pushContactToSupabase, 
  deleteContactFromSupabase, 
  pushAuditLogToSupabase,
  loadFromSupabase,
  bulkUploadToSupabase,
  getResolvedCRMTableName,
  getResolvedContactsTableName,
  getResolvedAuditLogsTableName,
  getResolvedOCTableName,
  loadUsersFromSupabase,
  upsertUserToSupabase,
  initializeDefaultUsers,
  toValidUUID,
  pushPurchaseOrderToSupabase,
  getSupabaseClient,
  getCRMSettings,
  subscribeToCRMSettings,
  syncDailyExchangeRate,
  loadMoreCRMRecords,
  subscribeToGlobalPresence,
  setEditingRecord
} from '../supabaseService';

// Subcomponents convertidos a Carga Diferida (Lazy Loading)
const Dashboard = lazy(() => import('./Dashboard'));
const LeadsSection = lazy(() => import('./LeadsSection'));
const QuotationsSection = lazy(() => import('./QuotationsSection'));
const PurchaseOrdersSection = lazy(() => import('./PurchaseOrdersSection'));
const ContactsSection = lazy(() => import('./ContactsSection'));
const FollowupsSection = lazy(() => import('./FollowupsSection'));
const AuditSection = lazy(() => import('./AuditSection'));
const SyncSettingsSection = lazy(() => import('./SyncSettingsSection'));
const SyncSupabaseSection = lazy(() => import('./SyncSupabaseSection'));
const UserProfileSection = lazy(() => import('./UserProfileSection'));
const UserManagementSection = lazy(() => import('./UserManagementSection'));

// Icons
import {
  LayoutDashboard,
  Layers,
  FileSpreadsheet,
  FileCheck,
  Users,
  Compass,
  ShieldAlert,
  RefreshCw,
  Bell,
  Database,
  User,
  ChevronLeft,
  ChevronRight,
  Lock,
  AlertTriangle
} from 'lucide-react';

const getSupabaseConfig = () => {
  const prodUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const prodKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  return {
    url: prodUrl || localStorage.getItem('verse_supabase_url') || '',
    key: prodKey || localStorage.getItem('verse_supabase_key') || ''
  };
};

interface MainAppContentProps {
  session: any;
  setSession: React.Dispatch<React.SetStateAction<any>>;
  supabaseStatus: 'LOADING' | 'CONNECTED' | 'ERROR' | 'OFFLINE';
  setSupabaseStatus: React.Dispatch<React.SetStateAction<'LOADING' | 'CONNECTED' | 'ERROR' | 'OFFLINE'>>;
}

export default function MainAppContent({ 
  session, 
  setSession, 
  supabaseStatus, 
  setSupabaseStatus 
}: MainAppContentProps) {
  const { 
    records, setRecords, 
    contacts, setContacts, 
    purchaseOrders, setPurchaseOrders, 
    auditLogs, setAuditLogs, 
    registerLocalMutation,
    serverConfirmedMutationsRef,
    preloadAllData,
    isInitialLoading,
    showToast
  } = useData();

  // --- Estado Global de Presencia y Bloqueos de Concurrencia ---
  const [activeLocks, setActiveLocks] = useState<Record<string, any>>({});
  const presenceChannelRef = useRef<any>(null);

  // Configuración de interfaz que SÍ puede quedarse en localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('verse_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('verse_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Simulator configurations
  const [role, setRole] = useState<UserRole>(() => {
    const local = localStorage.getItem('verse_crm_role');
    return (local as UserRole) || 'Admin';
  });

  const [currentCurrency, setCurrentCurrency] = useState<'USD' | 'MXN'>('USD');
  const [activeTab, setActiveTab ] = useState('Dashboard');
  const [pulseNotification, setPulseNotification] = useState(true);
  const [prefilledLeadForOC, setPrefilledLeadForOC] = useState<CRMRecord | null>(null);

  const [dbUsers, setDbUsers] = useState<UserAccount[]>([]);
  const [userStatus, setUserStatus] = useState<'active' | 'pending' | 'rejected' | 'not_logged_in' | 'loading'>('loading');

  const { url, key } = getSupabaseConfig();
  const supabase = getSupabaseClient(url, key);

  // Derived Google User state from Supabase Auth Session
  const googleUser = session?.user ? {
    name: session.user.user_metadata?.full_name || session.user.email || '',
    email: session.user.email || '',
    picture: session.user.user_metadata?.avatar_url || ''
  } : null;

  // Derived Google Token from Supabase session
  const googleToken = session?.provider_token || session?.access_token || '';

  const checkUserAccess = async (email: string, fullName: string) => {
    setUserStatus('loading');
    const { url, key } = getSupabaseConfig();

    const lowerEmail = email.trim().toLowerCase();

    if (!url || !key) {
      // Offline / Local Simulation Mode
      const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
      let localUsers: UserAccount[] = JSON.parse(localUsersStr);
      setDbUsers(localUsers);

      let found = localUsers.find(u => u.email === lowerEmail);
      if (!found) {
        // Bootstrap first user as Admin, subsequent as Solo Lectura
        const defaultRole = localUsers.length === 0 ? 'Admin' : 'Solo Lectura';
        found = {
          id: toValidUUID(lowerEmail),
          email: lowerEmail,
          nombre: fullName,
          rol: defaultRole,
          estado: 'active',
          created_at: getMexicoCityDateTimeString()
        };
        localUsers.push(found);
        localStorage.setItem('verse_local_users', JSON.stringify(localUsers));
        setDbUsers(localUsers);
        appendAuditLog('MODIFICACIÓN', `Nueva solicitud de acceso registrada para: ${lowerEmail} (Modo Local)`);
      }
      
      setRole(found.rol);
      setUserStatus(found.estado);
      return;
    }

    try {
      // Fetch user from Supabase with resilient default users setup
      await initializeDefaultUsers(url, key);
      const result = await loadUsersFromSupabase(url, key);

      if (result.success) {
        const dbUsers = result.users;
        setDbUsers(dbUsers);
        const found = dbUsers.find(u => u.email === lowerEmail);

        if (found) {
          if (found.estado === 'active') {
            setRole(found.rol);
            setUserStatus('active');
          } else if (found.estado === 'rejected') {
            setUserStatus('rejected');
          } else {
            setUserStatus('pending');
          }
        } else {
          // Create new request. Bootstrap first user as Admin if database is empty.
          const defaultRole = dbUsers.length === 0 ? 'Admin' : 'Solo Lectura';
          const newReq: UserAccount = {
            id: toValidUUID(lowerEmail),
            email: lowerEmail,
            nombre: fullName,
            rol: defaultRole,
            estado: defaultRole === 'Admin' ? 'active' : 'pending',
            created_at: getMexicoCityDateTimeString()
          };
          const ok = await upsertUserToSupabase(url, key, newReq);
          if (ok) {
            setRole(newReq.rol);
            setUserStatus(newReq.estado);
            appendAuditLog('MODIFICACIÓN', `Nueva solicitud de acceso registrada en Supabase para: ${lowerEmail}`, lowerEmail);
          } else {
            setUserStatus('pending');
          }
        }
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.warn("Error verifying access in Supabase, using local fallback:", err);
      // Failover logic using local simulated/cached users list dynamically
      const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
      const localUsers: UserAccount[] = JSON.parse(localUsersStr);
      const found = localUsers.find(u => u.email === lowerEmail);
      if (found) {
        setRole(found.rol);
        setUserStatus(found.estado);
      } else {
        // Safe fallback default
        setRole('Solo Lectura');
        setUserStatus('pending');
      }
    }
  };

  const handleDisconnectGoogle = async () => {
    if (session?.user?.email) {
      appendAuditLog('CERRAR SESIÓN', `Usuario cerró sesión de forma segura.`, session.user.email);
    }
    
    if (supabase) await supabase.auth.signOut();
    
    setSession(null);
    setUserStatus('not_logged_in');
    setActiveTab('Dashboard');
    localStorage.removeItem('verse_sheet_token');
    localStorage.removeItem('verse_google_user');
    localStorage.removeItem('verse_is_logged_in');
    showToast('Sesión cerrada con éxito.', 'info');
  };

  const [isSupabaseLoading, setIsSupabaseLoading] = useState(false);
  // --- ESTADOS DE PAGINACIÓN FASE 3 ---
  const [recordsOffset, setRecordsOffset] = useState(150);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMoreRecords = async () => {
    setIsLoadingMore(true);
    const { url, key } = getSupabaseConfig();
    
    const res = await loadMoreCRMRecords(url, key, recordsOffset, 150);
    
    if (res.success && res.records.length > 0) {
      // Unimos los nuevos registros cuidando no duplicar IDs
      setRecords(prev => {
        const newUnique = res.records.filter(r => !prev.some(p => p.id === r.id));
        return [...prev, ...newUnique];
      });
      setRecordsOffset(prev => prev + 150);
      if (res.records.length < 150) setHasMoreRecords(false); // Ya no hay más en la base de datos
    } else {
      setHasMoreRecords(false); // Se acabaron
    }
    setIsLoadingMore(false);
  };

  // Sync state helpers
  const [exchangeRate, setExchangeRate] = useState<number>(17.05);

  // Load exchange rate from crm_settings and subscribe to real-time updates
  useEffect(() => {
    let active = true;
    let subscription: any = null;

    const loadSettings = async () => {
      const { url, key } = getSupabaseConfig();
      if (!url || !key) return;

      try {
        // Sincronizar y obtener el tipo de cambio del día (actualización diaria automática)
        const activeRate = await syncDailyExchangeRate(url, key);
        if (active) {
          setExchangeRate(activeRate);
        }
      } catch (err) {
        console.warn('Error syncing daily exchange rate in App.tsx:', err);
        // Fallback: obtener la configuración existente de Supabase
        try {
          const settings = await getCRMSettings(url, key);
          if (active && settings && (settings as any).exchange_rate_usd_mxn) {
            setExchangeRate(Number((settings as any).exchange_rate_usd_mxn));
          }
        } catch (fetchErr) {
          console.warn('Error fetching fallback exchange rate:', fetchErr);
        }
      }
    };

    loadSettings();

    const { url, key } = getSupabaseConfig();
    if (url && key) {
      try {
        subscription = subscribeToCRMSettings((payload) => {
          if (payload.new && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
            if (active && payload.new.exchange_rate_usd_mxn) {
              setExchangeRate(Number(payload.new.exchange_rate_usd_mxn));
            }
          }
        }, url, key);
      } catch (err) {
        console.warn('Error subscribing to crm_settings in App.tsx:', err);
      }
    }

    return () => {
      active = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const hasLoadedRef = useRef(false);

  // Startup mount automatic check & load from Supabase Cloud
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const addSupabaseLogToStorage = (message: string, type: 'info' | 'success' | 'warn' | 'error') => {
      const timestamp = getMexicoCityTimeString();
      const localLogs = localStorage.getItem('verse_supabase_sync_logs');
      let logArray = [];
      if (localLogs) {
        try {
          logArray = JSON.parse(localLogs);
        } catch (e) {
          logArray = [];
        }
      }
      logArray.push({ timestamp, type, message });
      if (logArray.length > 200) {
        logArray = logArray.slice(-200);
      }
      localStorage.setItem('verse_supabase_sync_logs', JSON.stringify(logArray));
    };

    const fetchFromSupabaseOnStart = async () => {
      const prodUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const prodKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      let { url, key } = getSupabaseConfig();
      
      // Auto-correct any misspelled, outdated, or empty values on mount ONLY if not using prod variables
      if (!prodUrl && (!url || url.includes('bkeyhvbr4b4eokigmdgftu') || url.includes('iqxwrfjdvixidsnfwja'))) {
        url = 'https://iqxwrfjfdvixidsnfwja.supabase.co';
        localStorage.setItem('verse_supabase_url', url);
        addSupabaseLogToStorage('Se corrigió el host de Supabase por defecto a la URL correcta.', 'info');
      }
      if (!prodKey && (!key || key.startsWith('sb_secret_'))) {
        key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeHdyZmpmZHZpeGlkc25md2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjc2NDEsImV4cCI6MjA5NjcwMzY0MX0.mt76SY7Op1JdsjnJ3YoMQocWz40-Q0gp23poSqKTaEg';
        localStorage.setItem('verse_supabase_key', key);
        addSupabaseLogToStorage('Se corrigió la clave API Anon Key de Supabase por defecto.', 'info');
      }

      if (googleUser) {
        await checkUserAccess(googleUser.email, googleUser.name);
      }

      if (url && key) {
        setSupabaseStatus('LOADING');
        addSupabaseLogToStorage('Arranque: Iniciando descarga en segundo plano desde Supabase...', 'info');

        try {
          const result = await preloadAllData(url, key);
          if (result.success) {
            setSupabaseStatus('CONNECTED');
            addSupabaseLogToStorage(`¡Sincronización reactiva exitosa!`, 'success');
            showToast('Sincronización inicial exitosa con Supabase Cloud', 'success');
          } else {
            console.warn('Fallo al cargar de Supabase:', result.message);
            setSupabaseStatus('ERROR');
            addSupabaseLogToStorage(`Fallo en conexión: ${result.message}`, 'error');
            appendAuditLog('ERROR', `Fallo al cargar desde Supabase: ${result.message}`);
          }
        } catch (error: any) {
          console.error('Error durante sincronización reactiva:', error);
          setSupabaseStatus('ERROR');
          addSupabaseLogToStorage(`Error crítico de persistencia: ${error.message || error}`, 'error');
          appendAuditLog('ERROR', `Error crítico durante sincronización con Supabase: ${error.message || error}`);
        }
      } else {
        addSupabaseLogToStorage('Arranque: No hay credenciales de Supabase guardadas en el navegador, operando en caché local.', 'warn');
      }
    };
    fetchFromSupabaseOnStart();
  }, [googleUser?.email]);

  // 🛡️ Sincronizar presencia global
  useEffect(() => {
    if (userStatus !== 'active' || !supabase || !googleUser) return;

    if (!presenceChannelRef.current) {
      presenceChannelRef.current = subscribeToGlobalPresence(
        supabase, 
        { name: googleUser.name, email: googleUser.email }, 
        (locks) => {
          setActiveLocks(locks);
        }
      );
    }

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [userStatus, supabase, googleUser?.email]);

  useEffect(() => {
    const prevRole = localStorage.getItem('verse_crm_role');
    if (prevRole && prevRole !== role) {
      appendAuditLog('MODIFICACIÓN', `Cambio de perfil operativo de usuario a: ${role} (Perfil anterior: ${prevRole})`);
    }
    localStorage.setItem('verse_crm_role', role);
  }, [role]);

  // Sincronización de registros
  const syncCRMRecordToSupabaseIfNeeded = async (record: CRMRecord, action: 'UPSERT' | 'DELETE'): Promise<boolean> => {
    const { url, key } = getSupabaseConfig();
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return true;

    try {
      if (action === 'DELETE') {
        const success = await deleteCRMRecordFromSupabase(url, key, record.id);
        if (success) {
          showToast(`Expediente ${record.informacion_general_folio} eliminado de Supabase`, 'success');
          return true;
        } else {
          showToast(`Error al eliminar expediente ${record.informacion_general_folio}`, 'error');
          return false;
        }
      } else {
        const success = await pushCRMRecordToSupabase(url, key, record);
        if (success) {
          showToast(`Expediente ${record.informacion_general_folio} sincronizado con Supabase`, 'success');
          return true;
        } else {
          showToast(`Error al sincronizar expediente ${record.informacion_general_folio}`, 'error');
          return false;
        }
      }
    } catch (e: any) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
      showToast(`Error de red con Supabase (Expediente): ${e.message}`, 'error');
      return false;
    }
  };

  const syncContactToSupabaseIfNeeded = async (contact: Contact, action: 'UPSERT' | 'DELETE'): Promise<boolean> => {
    const { url, key } = getSupabaseConfig();
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return true;

    try {
      if (action === 'DELETE') {
        const success = await deleteContactFromSupabase(url, key, contact.id, contact.email);
        if (success) {
          showToast(`Contacto ${contact.nombre} eliminado de Supabase`, 'success');
          return true;
        } else {
          showToast(`Error al eliminar contacto ${contact.nombre}`, 'error');
          return false;
        }
      } else {
        const success = await pushContactToSupabase(url, key, contact);
        if (success) {
          showToast(`Contacto ${contact.nombre} sincronizado con Supabase`, 'success');
          return true;
        } else {
          showToast(`Error al sincronizar contacto ${contact.nombre}`, 'error');
          return false;
        }
      }
    } catch (e: any) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
      showToast(`Error de red con Supabase (Contacto): ${e.message}`, 'error');
      return false;
    }
  };

  const syncAuditLogToSupabaseIfNeeded = async (log: AuditLog) => {
    const { url, key } = getSupabaseConfig();
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return;

    try {
      await pushAuditLogToSupabase(url, key, log);
    } catch (e) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
    }
  };

  function appendAuditLog(accion: AuditLog['accion'], detalles: string, customOperador?: string) {
    const activeOperator = customOperador || googleUser?.email || 'operador@crm.com';
    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      fecha: getMexicoCityDateTimeString(),
      accion,
      operador: activeOperator,
      perfil: role,
      detalles
    };
    setAuditLogs((prev) => [newLog, ...prev].slice(0, 15));
    syncAuditLogToSupabaseIfNeeded(newLog);
  }

  const handleResetDatabase = () => {
    setRecords(INITIAL_RECORDS);
    setContacts(INITIAL_CONTACTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    appendAuditLog('RESTABLECIMIENTO', 'Reestableció la consistencia del sandbox al estado estándar original (Bimbo, AstraZeneca, UNAM)');
  };

  const handleClearLogs = () => {
    setAuditLogs([]);
    const initialLog: AuditLog = {
      id: `aud_${Date.now()}`,
      fecha: getMexicoCityDateTimeString(),
      accion: 'RESTABLECIMIENTO',
      operador: googleUser?.email || 'operador@crm.com',
      perfil: role,
      detalles: 'Bitácora técnica de seguridad depurada e inicializada por el Administrador.'
    };
    setAuditLogs([initialLog]);
  };

  const handleSetEditing = async (recordId: string | null) => {
    if (presenceChannelRef.current && session?.user) {
      const email = session.user.email || '';
      const name = session.user.user_metadata?.full_name || email;
      await setEditingRecord(presenceChannelRef.current, recordId, { name, email });
    }
  };

  if (userStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-10 h-10 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-base font-bold mb-1">Verificando Autorización de Acceso...</h2>
        <p className="text-xs text-slate-400">Consultando estado del usuario en la base de datos de Verse Technology.</p>
      </div>
    );
  }

  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md bg-slate-900 border border-amber-500/30 p-8 rounded-2xl shadow-xl space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-amber-400">Solicitud de Acceso en Proceso</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tu solicitud para acceder a la plataforma está siendo revisada. Se te brindará el acceso una vez que tu usuario sea aprobado.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => checkUserAccess(googleUser?.email || '', googleUser?.name || '')}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Verificar Estado
            </button>
            <button
              onClick={handleDisconnectGoogle}
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md bg-slate-900 border border-rose-500/30 p-8 rounded-2xl shadow-xl space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-rose-400">Acceso Denegado</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Hola, <span className="font-bold text-white">{googleUser?.name}</span> (<span className="text-rose-300">{googleUser?.email}</span>). Tu solicitud de acceso ha sido rechazada por el administrador.
          </p>
          <div className="p-3 bg-slate-950 rounded-lg text-[11px] text-slate-400 border border-slate-800">
            Si consideras que esto es un error o necesitas solicitar un cambio de estado, por favor contacta al administrador en <span className="text-rose-300">soporte@verse-technology.com</span>.
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => checkUserAccess(googleUser?.email || '', googleUser?.name || '')}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Reintentar Conexión
            </button>
            <button
              onClick={handleDisconnectGoogle}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-10 h-10 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-base font-bold mb-1">Sincronizando Base de Datos...</h2>
        <p className="text-xs text-slate-400">Cargando expedientes y bitácoras seguras desde Supabase Cloud.</p>
      </div>
    );
  }

  return (
    <PresenceContext.Provider value={{ 
      activeLocks, 
      currentUserEmail: session?.user?.email || '', 
      setEditingRecordId: handleSetEditing 
    }}>
      <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden text-slate-900 select-none antialiased">
      {/* BARRA DE SEGURIDAD SUPERIOR PREMIUM SLATE-900 */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          {localStorage.getItem('verse_custom_logo') ? (
            <div className="w-8 h-8 flex items-center justify-center p-0.5 bg-slate-800 rounded border border-slate-700 shadow-inner">
              <img 
                src={localStorage.getItem('verse_custom_logo') || ''} 
                alt="Logo Oficial" 
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center select-none" title="Verse Technology Logo Oficial">
              <svg viewBox="0 0 100 100" className="w-8 h-8 rounded-md shadow-md overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" fill="#2f67ff" />
                <text x="52" y="52" fill="white" fontSize="68" fontWeight="900" fontFamily='"Outfit", "Inter", "Space Grotesk", sans-serif' textAnchor="middle" dominantBaseline="central">T</text>
              </svg>
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white leading-tight">
              Verse <span className="font-light text-slate-400 text-xs italic ml-1">CRM Inteligente</span>
            </h1>
            <span className="text-[8px] text-slate-400 font-semibold tracking-widest uppercase block mt-0.5 font-mono">
              SATELLITE v2.4.mex
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* SIMULADOR DE ROL - ESTILO BOTONES INTEGRADAS */}
          <div className="hidden md:flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setRole('Admin')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                role === 'Admin' ? 'bg-[#2f67ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Administrador (Admin)
            </button>
            <button
              onClick={() => setRole('Vendedor')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                role === 'Vendedor' ? 'bg-[#2f67ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Vendedor (Comercial)
            </button>
            <button
              onClick={() => setRole('Solo Lectura')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                role === 'Solo Lectura' ? 'bg-[#2f67ff] text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔒 Auditor (Lectura)
            </button>
          </div>

          {/* Fallback selector for mobile */}
          <div className="flex md:hidden bg-slate-800 rounded px-2 py-1 border border-slate-755 text-xs">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-transparent border-none text-white outline-none text-xs"
            >
              <option value="Admin" className="bg-slate-900 text-white">Administrador (Admin)</option>
              <option value="Vendedor" className="bg-slate-900 text-white font-sans">Vendedor (Comercial)</option>
              <option value="Solo Lectura" className="bg-slate-900 text-white">🔒 Auditor (Lectura)</option>
            </select>
          </div>

          <div className="h-8 w-px bg-slate-700/60 font-sans"></div>

          {/* USER INFO & PROFILE AVATAR DESDE GOOGLE OAUTH */}
          <div 
            onClick={() => setActiveTab('UserProfile')}
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-800 p-1.5 px-2.5 rounded-lg border border-transparent hover:border-slate-700 transition-all select-none"
            title="Ver Perfil de Inicio & Configuración"
          >
            {googleUser ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-100">{googleUser.name}</p>
                  <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest font-mono">Google Conectado</p>
                </div>
                {googleUser.picture ? (
                  <img 
                    referrerPolicy="no-referrer"
                    src={googleUser.picture} 
                    alt={googleUser.name} 
                    className="w-8 h-8 rounded-full border border-green-500 object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-700 border border-green-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {googleUser.name.charAt(0)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-100 font-sans font-sans">Geovanni Verse</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono font-sans">Administración</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-slate-205 shadow-sm">
                  G
                </div>
              </>
            )}
          </div>

          {/* BELL NOTIFICATION */}
          <div className="relative">
            <button
              onClick={() => {
                setPulseNotification(false);
                alert('Notificaciones CRM: Todo se encuentra perfectamente sincronizado con Google Sheets Live.');
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors relative"
              title="Notificaciones de Auditoría del SAT"
            >
              <Bell className="w-4 h-4" />
              {pulseNotification && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* LOWER DIVISION: SIDEBAR + MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* 1. LEFT SIDEBAR CON EXCELENTE DISEÑO WHITE POLISH COLLAPSIBLE */}
        <motion.aside
          initial={false}
          animate={{ 
            width: isSidebarCollapsed ? 68 : 224,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30 
          }}
          className="bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 z-30 select-none shadow-3xs relative"
        >
          {/* BOTÓN DE COLAPSO / EXPANSIÓN FLOTANTE */}
          <button
            onClick={toggleSidebar}
            className="absolute -right-3.5 top-12 bg-white border border-slate-200 rounded-full p-1 shadow-[0_2px_4px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.12)] hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all z-50 cursor-pointer hidden sm:flex items-center justify-center w-7 h-7 group"
            title={isSidebarCollapsed ? "Expandir menú (Consola)" : "Colapsar menú (Consola)"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            ) : (
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            )}
          </button>
          
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest px-2 mb-2 truncate">
                  Consola Operativa
                </p>
              ) : (
                <div className="h-px bg-slate-100 my-2 mx-1 duration-200" />
              )}
              
              <button
                onClick={() => setActiveTab('Dashboard')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'Dashboard'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Dashboard" : undefined}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Dashboard</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeTab === 'Dashboard' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {records.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('Leads/Projects')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'Leads/Projects'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Proyectos / Leads" : undefined}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Proyectos / Leads</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeTab === 'Leads/Projects' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {records.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('Quotations')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'Quotations'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Cotizaciones (PDF)" : undefined}
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Cotizaciones (PDF)</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">$</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('PurchaseOrders')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'PurchaseOrders'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Órdenes de Compra" : undefined}
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Órdenes de Compra</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                    {records.filter((r) => r.estado_proyecto === 'Cerrado Ganado').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('Contacts')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'Contacts'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Contactos" : undefined}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Contactos</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="bg-slate-105 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono">{contacts.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('Followups')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'Followups'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Bitácora Seguimiento" : undefined}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Bitácora Seguimiento</span>
                  )}
                </span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1">
              {!isSidebarCollapsed ? (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 truncate">
                  Seguridad y Datos
                </p>
              ) : (
                <div className="h-px bg-slate-100 my-2 mx-1 duration-200" />
              )}

              {role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('Audit')}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
                  } text-xs font-semibold rounded-md transition-all duration-300 ${
                    activeTab === 'Audit'
                      ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={isSidebarCollapsed ? "Auditoría" : undefined}
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 transition-transform duration-200" />
                    {!isSidebarCollapsed && (
                      <span className="animate-in fade-in duration-200 truncate">Auditoría</span>
                    )}
                  </span>
                </button>
              )}

              {role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('UserManagement')}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                  } text-xs font-semibold rounded-md transition-all duration-300 ${
                    activeTab === 'UserManagement'
                      ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={isSidebarCollapsed ? "Control de Usuarios" : undefined}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0 transition-transform duration-200" />
                    {!isSidebarCollapsed && (
                      <span className="animate-in fade-in duration-200 truncate">Control de Usuarios</span>
                    )}
                  </span>
                  {!isSidebarCollapsed && dbUsers.filter(u => u.estado === 'pending').length > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold animate-pulse">
                      {dbUsers.filter(u => u.estado === 'pending').length}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => setActiveTab('SyncSettings')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'SyncSettings'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Config. Sheets" : undefined}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Config. Sheets</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('SyncSupabase')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'SyncSupabase'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Puente Supabase" : undefined}
              >
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Puente Supabase</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('UserProfile')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                } text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === 'UserProfile'
                    ? 'bg-slate-100 text-blue-700 font-bold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={isSidebarCollapsed ? "Mi Perfil" : undefined}
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 shrink-0 transition-transform duration-200" />
                  {!isSidebarCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">Mi Perfil</span>
                  )}
                </span>
                {!isSidebarCollapsed && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-mono font-bold px-1.5 py-0.5 rounded">
                    {role}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* LOWER LIVE SYNC STATUS EN AMBIENTE GRIS CLARO */}
          <div className={`p-4 border-t border-slate-100 bg-slate-50 transition-all ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
            {isSidebarCollapsed ? (
              <div 
                className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse cursor-help"
                title="Sheets Live Sync Activo - v_db_verse_prod_01 (Último cambio: Hace 2 min)"
              />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sheets Live Sync</span>
                </div>
                <p className="text-[10px] text-slate-450 leading-tight font-mono">
                  v_db_verse_prod_01<br />
                  <span className="text-slate-400 text-[9px]">Último cambio: Hace 2 min</span>
                </p>
              </>
            )}
          </div>
        </motion.aside>

        {/* 2. MAIN VIEW AREA / CENTRAL SECTION */}
        <main className="grow flex flex-col overflow-hidden bg-slate-50/55">
          {/* DASHBOARD PRINCIPAL HEADER */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-3xs">
            <div>
              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono mr-2">
                Conexión segura SAT/ISO
              </span>
              <span className="text-xs text-slate-500">
                Base de Datos: <strong className={getSupabaseConfig().url && getSupabaseConfig().key ? "text-blue-600 font-bold" : "text-amber-600 font-medium"}>
                  {getSupabaseConfig().url && getSupabaseConfig().key ? "Supabase Cloud Activa" : "Persistencia Local (Modo Demostración)"}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* GLOBAL MONEDA SWITCHER SELECTOR */}
              <div className="flex bg-slate-100 rounded border border-slate-200 p-0.5">
                <button
                  onClick={() => setCurrentCurrency('MXN')}
                  className={`px-4 py-1 text-xs font-semibold rounded transition-all ${
                    currentCurrency === 'MXN'
                      ? 'bg-white shadow-3xs text-slate-800 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  MXN
                </button>
                <button
                  onClick={() => setCurrentCurrency('USD')}
                  className={`px-4 py-1 text-xs font-semibold rounded transition-all ${
                    currentCurrency === 'USD'
                      ? 'bg-white shadow-3xs text-slate-800 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  USD
                </button>
              </div>

              {/* CONTEXT ACTIVE BUTTONS BASED ON ACTIVE TAB */}
              {activeTab === 'Leads/Projects' && (
                <button
                  onClick={() => {
                    const addBtn = document.getElementById('add-record-trigger-btn');
                    if (addBtn) addBtn.click();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-3xs hover:bg-blue-700 transition-colors uppercase tracking-wide"
                >
                  Nuevo Lead / Proyecto
                </button>
              )}
              {activeTab === 'Contacts' && (
                <button
                  onClick={() => {
                    const addConBtn = document.getElementById('add-contact-trigger-btn');
                    if (addConBtn) addConBtn.click();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-3xs hover:bg-blue-700 transition-colors uppercase tracking-wide"
                >
                  Nuevo Contacto Planta
                </button>
              )}
              {activeTab !== 'Leads/Projects' && activeTab !== 'Contacts' && (
                <button
                  onClick={() => setActiveTab('Leads/Projects')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-3xs hover:bg-blue-700 transition-colors uppercase tracking-wide"
                >
                  Ver Listado General
                </button>
              )}
            </div>
          </div>

          {/* VIEW AREA / SCREEN RENDERING GRID */}
          <div className="flex-1 p-6 overflow-y-auto w-full mx-auto space-y-6">
            
            {/* 🚨 NUEVA PANTALLA DE CARGA ESTRICTA 🚨 */}
            {isSupabaseLoading || supabaseStatus === 'LOADING' ? (
              <div className="flex flex-col items-center justify-center w-full min-h-[60vh] text-slate-500">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-sm font-bold text-slate-700">Sincronizando con Supabase Cloud...</h3>
                <p className="text-xs mt-2 font-mono">Descargando expedientes y reglas de negocio seguras.</p>
              </div>
            ) : (
              <Suspense 
                fallback={
                  <div className="flex flex-col items-center justify-center w-full min-h-[50vh] text-slate-400">
                    <div className="w-8 h-8 border-2 border-t-transparent border-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-xs font-semibold animate-pulse tracking-wide uppercase">Cargando módulo...</p>
                  </div>
                }
              >
              {activeTab === 'Dashboard' && (
                <Dashboard
                  exchangeRate={exchangeRate}
                  currentCurrency={currentCurrency}
                  role={role}
                  isSupabaseConfigured={!!(getSupabaseConfig().url && getSupabaseConfig().key)}
                  onEditRecord={(rec) => {
                    setActiveTab('Leads/Projects');
                  }}
                  onNavigate={(tab) => {
                    if (tab === 'Leads/Projects') setActiveTab('Leads/Projects');
                  }}
                />
              )}

              {activeTab === 'Leads/Projects' && (
                <LeadsSection
                  records={records}
                  contacts={contacts}
                  role={role}
                  dbUsers={dbUsers}
                  exchangeRate={exchangeRate}
                  onLoadMore={handleLoadMoreRecords}
                  hasMoreRecords={hasMoreRecords}
                  isLoadingMore={isLoadingMore}
                  onRedirectToOC={(record) => {
                    setPrefilledLeadForOC(record);
                    setActiveTab('PurchaseOrders');
                  }}
                  onAddRecord={async (nRecord) => {
                    registerLocalMutation(nRecord.id);
                    setRecords((prev) => [nRecord, ...prev]);
                    
                    try {
                      const success = await syncCRMRecordToSupabaseIfNeeded(nRecord, 'UPSERT');
                      if (!success) throw new Error('Rechazado por el servidor');
                      serverConfirmedMutationsRef.current?.delete(nRecord.id);
                    } catch (error) {
                      console.error("Fallo asíncrono en canal HTTP (Insert):", error);
                      
                      if (serverConfirmedMutationsRef.current?.has(nRecord.id)) {
                        console.log("Inserción HTTP falló por timeout, pero Realtime ya confirmó la persistencia.");
                        serverConfirmedMutationsRef.current?.delete(nRecord.id);
                      } else {
                        setRecords((prev) => prev.filter(item => item.id !== nRecord.id));
                        showToast(`❌ Error de red. El registro no pudo ser creado.`, 'error');
                      }
                    }
                  }}
                  onUpdateRecord={async (uRecord) => {
                    const originalRecord = records.find(r => r.id === uRecord.id);
                    if (!originalRecord) return;

                    registerLocalMutation(uRecord.id); 
                    setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                    
                    try {
                      const success = await syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                      if (!success) throw new Error('Rechazado por el servidor');
                      serverConfirmedMutationsRef.current?.delete(uRecord.id);
                    } catch (error) {
                      console.error("Fallo asíncrono en canal HTTP (Update):", error);
                      
                      if (serverConfirmedMutationsRef.current?.has(uRecord.id)) {
                        console.log("Sincronización HTTP falló por red, pero Realtime ya unificó el estado con éxito.");
                        serverConfirmedMutationsRef.current?.delete(uRecord.id);
                      } else {
                        setRecords((prev) => prev.map((item) => (item.id === uRecord.id && item === uRecord ? originalRecord : item)));
                        showToast(`❌ Error al guardar. Cambios revertidos en el folio.`, 'error');
                      }
                    }
                  }}
                  onDeleteRecord={async (delId) => {
                    const originalRecord = records.find(item => item.id === delId);
                    if (!originalRecord) return;

                    registerLocalMutation(delId);
                    setRecords((prev) => prev.filter(item => item.id !== delId));
                    
                    try {
                      const success = await syncCRMRecordToSupabaseIfNeeded(originalRecord, 'DELETE');
                      if (!success) throw new Error('Rechazado por el servidor');
                      serverConfirmedMutationsRef.current?.delete(delId);
                    } catch (error) {
                      console.error("Fallo asíncrono en canal HTTP (Delete):", error);
                      
                      if (serverConfirmedMutationsRef.current?.has(delId)) {
                        console.log("Eliminación HTTP falló por timeout, pero Realtime ya corroboró el borrado.");
                        serverConfirmedMutationsRef.current?.delete(delId);
                      } else {
                        setRecords((prev) => [originalRecord, ...prev]);
                        showToast(`❌ Error al eliminar. Registro restaurado.`, 'error');
                      }
                    }
                  }}
                  onShowAudit={appendAuditLog}
                  onAddContact={async (nCon) => {
                    registerLocalMutation('contactos', 'INSERT', nCon.id);
                    setContacts((prev) => [nCon, ...prev]);
                    const success = await syncContactToSupabaseIfNeeded(nCon, 'UPSERT');
                    if (!success) {
                      setContacts((prev) => {
                        const first = prev[0];
                        if (first && first.id === nCon.id && first === nCon) {
                          showToast(`Reversión (Rollback): Falló inserción de contacto ${nCon.nombre}`, 'error');
                          return prev.filter(item => item !== nCon);
                        }
                        return prev;
                      });
                    }
                  }}
                />
              )}

              {activeTab === 'Quotations' && (
                <QuotationsSection records={records} exchangeRate={exchangeRate} onShowAudit={appendAuditLog} />
              )}

              {activeTab === 'PurchaseOrders' && (
                <PurchaseOrdersSection
                  records={records}
                  role={role}
                  onUpdateRecord={async (uRecord) => {
                    const originalRecord = records.find(item => item.id === uRecord.id);
                    if (!originalRecord) return;
                    registerLocalMutation('crm_records', 'UPDATE', uRecord.id);
                    setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                    const success = await syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                    if (!success) {
                      setRecords((prev) => prev.map((item) => (item.id === uRecord.id && item === uRecord) ? originalRecord : item));
                    }
                  }}
                  onShowAudit={appendAuditLog}
                  prefilledLead={prefilledLeadForOC}
                  clearPrefilledLead={() => setPrefilledLeadForOC(null)}
                />
              )}

              {activeTab === 'Contacts' && (
                <ContactsSection
                  contacts={contacts}
                  role={role}
                  onAddContact={async (nCon) => {
                    registerLocalMutation('contactos', 'INSERT', nCon.id);
                    setContacts((prev) => [nCon, ...prev]);
                    const success = await syncContactToSupabaseIfNeeded(nCon, 'UPSERT');
                    if (!success) {
                      setContacts((prev) => {
                        const first = prev[0];
                        if (first && first.id === nCon.id && first === nCon) {
                          showToast(`Reversión (Rollback): Falló inserción de contacto ${nCon.nombre}`, 'error');
                          return prev.filter(item => item !== nCon);
                        }
                        return prev;
                      });
                    }
                  }}
                  onDeleteContact={async (delId) => {
                    const targetContact = contacts.find(c => c.id === delId);
                    if (!targetContact) return;
                    const originalIndex = contacts.findIndex(c => c.id === delId);
                    registerLocalMutation('contactos', 'DELETE', delId);
                    setContacts((prev) => prev.filter((item) => item.id !== delId));
                    const success = await syncContactToSupabaseIfNeeded(targetContact, 'DELETE');
                    if (!success) {
                      setContacts((prev) => {
                        if (prev.some(item => item.id === delId)) return prev;
                        showToast(`Reversión (Rollback): Falló eliminación de contacto ${targetContact.nombre}`, 'error');
                        const copy = [...prev];
                        if (originalIndex >= 0 && originalIndex <= prev.length) {
                          copy.splice(originalIndex, 0, targetContact);
                          return copy;
                        }
                        return [targetContact, ...prev];
                      });
                    }
                  }}
                  onShowAudit={appendAuditLog}
                />
              )}

              {activeTab === 'Followups' && (
                <FollowupsSection
                  records={records}
                  role={role}
                  onUpdateRecord={async (uRecord) => {
                    const originalRecord = records.find(item => item.id === uRecord.id);
                    if (!originalRecord) return;
                    registerLocalMutation('crm_records', 'UPDATE', uRecord.id);
                    setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                    const success = await syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                    if (!success) {
                      setRecords((prev) => prev.map((item) => (item.id === uRecord.id && item === uRecord) ? originalRecord : item));
                    }
                  }}
                  onShowAudit={appendAuditLog}
                />
              )}

              {activeTab === 'Audit' && (
                <AuditSection role={role} onShowAudit={appendAuditLog} />
              )}

              {activeTab === 'SyncSettings' && (
                <SyncSettingsSection
                  role={role}
                  onResetDatabase={handleResetDatabase}
                  onSyncComplete={async (responseLogs, syncedRecords) => {
                    if (syncedRecords && syncedRecords.length > 0) {
                      setRecords(syncedRecords);
                      
                      const { url, key } = getSupabaseConfig();
                      if (url && key) {
                        showToast('Subiendo registros de Google Sheets a Supabase Cloud...', 'info');
                        const res = await bulkUploadToSupabase(url, key, syncedRecords, contacts, auditLogs);
                        if (res.success) {
                          showToast('¡Base de datos Supabase actualizada correctamente!', 'success');
                          appendAuditLog('CONEXIÓN HOJA', 'Sincronizó y subió la base de datos desde Google Sheets a Supabase.');
                        } else {
                          showToast(`Error al subir a Supabase: ${res.message}`, 'error');
                        }
                      }
                    }
                  }}
                  onShowAudit={appendAuditLog}
                />
              )}

              {activeTab === 'SyncSupabase' && (
                <SyncSupabaseSection
                  role={role}
                  records={records}
                  contacts={contacts}
                  auditLogs={auditLogs}
                  onSyncComplete={(syncedRecords, syncedContacts, syncedLogs) => {
                    setRecords(syncedRecords || []);
                    setContacts(syncedContacts || []);
                    setAuditLogs(syncedLogs || []);
                  }}
                  onShowAudit={appendAuditLog}
                />
              )}

              {activeTab === 'UserProfile' && (
                <UserProfileSection
                  googleUser={googleUser}
                  googleToken={googleToken}
                  role={role}
                  onChangeRole={(newRole) => setRole(newRole)}
                  onDisconnect={handleDisconnectGoogle}
                />
              )}

              {activeTab === 'UserManagement' && role === 'Admin' && (
                <UserManagementSection
                  role={role}
                  onShowAudit={appendAuditLog}
                />
              )}
            </Suspense>
            )}
          </div>

          {/* LOWER STATUS FOOTER / TECHNICAL AUDIT CONTROL */}
          <footer className="h-10 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0 select-none text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wide">
                  G-Sheets Live
                </span>
              </div>
              <div className="h-4 w-px bg-slate-200"></div>
              
              {/* SUPABASE STATUS INDICATOR */}
              <div className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80" onClick={() => setActiveTab('SyncSupabase')} title="Clic para ver configuración de Supabase">
                <span className={`w-2 h-2 rounded-full ${
                  supabaseStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' :
                  supabaseStatus === 'ERROR' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' :
                  supabaseStatus === 'LOADING' ? 'bg-amber-400 animate-pulse' :
                  'bg-slate-300'
                }`}></span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                  supabaseStatus === 'ERROR' ? 'text-red-500' : 'text-slate-505'
                }`}>
                  Supabase Cloud {
                    supabaseStatus === 'CONNECTED' ? '(Conectado)' :
                    supabaseStatus === 'ERROR' ? '(Error de Conexión)' :
                    supabaseStatus === 'LOADING' ? '(Conectando...)' :
                    '(Desconectado)'
                  }
                </span>
              </div>
              
              <div className="h-4 w-px bg-slate-200"></div>
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[300px] lg:max-w-[400px]">
                Bitácora activa: [Operador: {googleUser?.email || 'Local'}] {auditLogs.length > 0 ? `ÚLTIMO: ${auditLogs[0].accion} - ${auditLogs[0].detalles.substring(0, 45)}...` : 'Listo'}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
              <span>Incoterms: DDP/EXW</span>
              <span>IVA: 16% Aplicado</span>
              <span className="text-blue-600">v2.4.0-build.mex</span>
            </div>
          </footer>
        </main>
      </div>
      </div>
    </PresenceContext.Provider>
  );
}
