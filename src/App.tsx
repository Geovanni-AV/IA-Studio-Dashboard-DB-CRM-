import React, { useState, useEffect } from 'react';
import { CRMRecord, Contact, AuditLog, UserRole } from './types';
import { INITIAL_RECORDS, INITIAL_CONTACTS, INITIAL_AUDIT_LOGS } from './mockData';
import { pushToGoogleSheets } from './googleSheetsService';
import SyncSupabaseSection from './components/SyncSupabaseSection';
import { 
  pushCRMRecordToSupabase, 
  deleteCRMRecordFromSupabase, 
  pushContactToSupabase, 
  deleteContactFromSupabase, 
  pushAuditLogToSupabase,
  loadFromSupabase,
  bulkUploadToSupabase
} from './supabaseService';

// Subcomponents
import Dashboard from './components/Dashboard';
import LeadsSection from './components/LeadsSection';
import QuotationsSection from './components/QuotationsSection';
import PurchaseOrdersSection from './components/PurchaseOrdersSection';
import ContactsSection from './components/ContactsSection';
import FollowupsSection from './components/FollowupsSection';
import AuditSection from './components/AuditSection';
import SyncSettingsSection from './components/SyncSettingsSection';

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
  Settings,
  Circle,
  HelpCircle,
  Globe,
  Plus,
  Database
} from 'lucide-react';

export default function App() {
  // --- Persistent States ---
  const [records, setRecords] = useState<CRMRecord[]>(() => {
    const local = localStorage.getItem('verse_crm_records');
    return local ? JSON.parse(local) : INITIAL_RECORDS;
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    const local = localStorage.getItem('verse_crm_contacts');
    return local ? JSON.parse(local) : INITIAL_CONTACTS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const local = localStorage.getItem('verse_crm_audit');
    return local ? JSON.parse(local) : INITIAL_AUDIT_LOGS;
  });

  // Simulator configurations
  const [role, setRole] = useState<UserRole>(() => {
    const local = localStorage.getItem('verse_crm_role');
    return (local as UserRole) || 'Admin';
  });

  const [currentCurrency, setCurrentCurrency] = useState<'USD' | 'MXN'>('USD');
  const [activeTab, setActiveTab ] = useState('Dashboard');
  const [pulseNotification, setPulseNotification] = useState(true);

  // States for loaders and feedback notifications
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' | null }>({
    show: false,
    message: '',
    type: null
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ show: true, message, type });
  };

  // Self-dismissing toast duration handler
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '', type: null });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Sync state helpers
  const exchangeRate = 17.05; // Standard B2B Exchange Rate

  // Startup mount automatic check & load from Supabase Cloud
  useEffect(() => {
    const fetchFromSupabaseOnStart = async () => {
      const url = localStorage.getItem('verse_supabase_url') || '';
      const key = localStorage.getItem('verse_supabase_key') || '';
      if (url && key) {
        // Skip automatic load and warning toasts for placeholder/demo values
        if (
          url === 'https://bkeyhvbr4b4eokigmdgftu.supabase.co' ||
          key === 'sb_secret_DMMi3TiTxGm8xYR4PmyMIw_kBiQW9jv'
        ) {
          console.log('Filtro de inicio Supabase: Valores de demostración detectados. Omitiendo.');
          return;
        }

        setIsSupabaseLoading(true);
        try {
          const result = await loadFromSupabase(url, key);
          if (result.success) {
            if (result.records && result.records.length > 0) {
              setRecords(result.records);
            }
            if (result.contacts && result.contacts.length > 0) {
              setContacts(result.contacts);
            }
            if (result.auditLogs && result.auditLogs.length > 0) {
              setAuditLogs(result.auditLogs);
            }
            showToast('Sincronización inicial exitosa con Supabase Cloud', 'success');
          } else {
            console.warn('Fallo al cargar de Supabase en el arranque:', result.message);
            showToast(`Fallo en carga inicial de Supabase: ${result.message}`, 'error');
          }
        } catch (error: any) {
          console.error('Error al iniciar persistencia Supabase:', error);
          showToast(`Error de conexión con Supabase: ${error.message}`, 'error');
        } finally {
          setIsSupabaseLoading(false);
        }
      }
    };
    fetchFromSupabaseOnStart();
  }, []);

  // Capture OAuth Access Token redirect inside Google's auth popup window
  useEffect(() => {
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const state = params.get('state');
      if (token && state === 'sheets_sync') {
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_SHEETS_TOKEN', token }, window.location.origin);
          window.close();
        }
      }
    }
  }, []);

  // Save states automatically
  useEffect(() => {
    localStorage.setItem('verse_crm_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('verse_crm_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('verse_crm_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('verse_crm_role', role);
  }, [role]);

  // Helper to trigger Supabase sync if enabled with visual feedback toasts
  const syncCRMRecordToSupabaseIfNeeded = async (record: CRMRecord, action: 'UPSERT' | 'DELETE') => {
    const url = localStorage.getItem('verse_supabase_url') || '';
    const key = localStorage.getItem('verse_supabase_key') || '';
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return;

    try {
      if (action === 'DELETE') {
        const success = await deleteCRMRecordFromSupabase(url, key, record.id);
        if (success) {
          showToast(`Expediente ${record.informacion_general_folio} eliminado de Supabase`, 'success');
        } else {
          showToast(`Error al eliminar expediente ${record.informacion_general_folio}`, 'error');
        }
      } else {
        const success = await pushCRMRecordToSupabase(url, key, record);
        if (success) {
          showToast(`Expediente ${record.informacion_general_folio} sincronizado con Supabase`, 'success');
        } else {
          showToast(`Error al sincronizar expediente ${record.informacion_general_folio}`, 'error');
        }
      }
    } catch (e: any) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
      showToast(`Error de red con Supabase (Expediente): ${e.message}`, 'error');
    }
  };

  const syncContactToSupabaseIfNeeded = async (contact: Contact, action: 'UPSERT' | 'DELETE') => {
    const url = localStorage.getItem('verse_supabase_url') || '';
    const key = localStorage.getItem('verse_supabase_key') || '';
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return;

    try {
      if (action === 'DELETE') {
        const success = await deleteContactFromSupabase(url, key, contact.id);
        if (success) {
          showToast(`Contacto ${contact.nombre} eliminado de Supabase`, 'success');
        } else {
          showToast(`Error al eliminar contacto ${contact.nombre}`, 'error');
        }
      } else {
        const success = await pushContactToSupabase(url, key, contact);
        if (success) {
          showToast(`Contacto ${contact.nombre} sincronizado con Supabase`, 'success');
        } else {
          showToast(`Error al sincronizar contacto ${contact.nombre}`, 'error');
        }
      }
    } catch (e: any) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
      showToast(`Error de red con Supabase (Contacto): ${e.message}`, 'error');
    }
  };

  const syncAuditLogToSupabaseIfNeeded = async (log: AuditLog) => {
    const url = localStorage.getItem('verse_supabase_url') || '';
    const key = localStorage.getItem('verse_supabase_key') || '';
    const autoSync = localStorage.getItem('verse_supabase_autosync') !== 'false';
    if (!url || !key || !autoSync) return;

    try {
      await pushAuditLogToSupabase(url, key, log);
    } catch (e) {
      console.warn('Errores de comunicación en background con Supabase auto-sync:', e);
    }
  };

  // Helper to append security logs
  const appendAuditLog = (accion: AuditLog['accion'], detalles: string) => {
    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 19),
      accion,
      operador: 'geovanni@verse-technology.com',
      perfil: role,
      detalles
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    syncAuditLogToSupabaseIfNeeded(newLog);
  };

  // Restores standard factory demo values (Astra, Bimbo, UNAM)
  const handleResetDatabase = () => {
    setRecords(INITIAL_RECORDS);
    setContacts(INITIAL_CONTACTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    appendAuditLog('RESTABLECIMIENTO', 'Reestableció la consistencia del sandbox al estado estándar original (Bimbo, AstraZeneca, UNAM)');
  };

  const handleClearLogs = () => {
    setAuditLogs([]);
    // Append initial system reset log
    const initialLog: AuditLog = {
      id: `aud_${Date.now()}`,
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 19),
      accion: 'RESTABLECIMIENTO',
      operador: 'geovanni@verse-technology.com',
      perfil: role,
      detalles: 'Bitácora técnica de seguridad depurada e inicializada por el Administrador.'
    };
    setAuditLogs([initialLog]);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden text-slate-900 select-none antialiased">
      {/* BARRA DE SEGURIDAD SUPERIOR PREMIUM SLATE-900 */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg text-white shadow-md">
            V
          </div>
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
                role === 'Admin' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Carlos (Admin)
            </button>
            <button
              onClick={() => setRole('Vendedor')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                role === 'Vendedor' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Laura (Ventas)
            </button>
            <button
              onClick={() => setRole('Solo Lectura')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                role === 'Solo Lectura' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔒 Auditor
            </button>
          </div>

          {/* Fallback selector for mobile */}
          <div className="flex md:hidden bg-slate-800 rounded px-2 py-1 border border-slate-750 text-xs">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-transparent border-none text-white outline-none text-xs"
            >
              <option value="Admin" className="bg-slate-900 text-white">Carlos (Admin)</option>
              <option value="Vendedor" className="bg-slate-900 text-white">Laura (Ventas)</option>
              <option value="Solo Lectura" className="bg-slate-900 text-white">🔒 Auditor</option>
            </select>
          </div>

          <div className="h-8 w-px bg-slate-700/60"></div>

          {/* USER INFO & PROFILE AVATAR */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">Carlos González</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Dirección General</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200">
              CG
            </div>
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
        
        {/* 1. LEFT SIDEBAR CON EXCELENTE DISEÑO WHITE POLISH */}
        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 z-30 select-none shadow-3xs">
          
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest px-2 mb-2">
                Consola Operativa
              </p>
              
              <button
                onClick={() => setActiveTab('Dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Dashboard'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Dashboard
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'Dashboard' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-500'
                }`}>
                  {records.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('Leads/Projects')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Leads/Projects'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 shrink-0" />
                  Proyectos / Leads
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'Leads/Projects' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-500'
                }`}>
                  {records.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('Quotations')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Quotations'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  Cotizaciones (PDF)
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">$</span>
              </button>

              <button
                onClick={() => setActiveTab('PurchaseOrders')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'PurchaseOrders'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 shrink-0" />
                  Órdenes de Compra
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {records.filter((r) => r.status_proyecto === 'Cerrado Ganado').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('Contacts')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Contacts'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0" />
                  Contactos
                </span>
                <span className="bg-slate-105 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono">{contacts.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('Followups')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Followups'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 shrink-0" />
                  Bitácora Seguimiento
                </span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
                Seguridad y Datos
              </p>

              <button
                onClick={() => setActiveTab('Audit')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'Audit'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  Auditoría
                </span>
              </button>

              <button
                onClick={() => setActiveTab('SyncSettings')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'SyncSettings'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  Config. Sheets
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              </button>

              <button
                onClick={() => setActiveTab('SyncSupabase')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'SyncSupabase'
                    ? 'bg-slate-100 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 shrink-0" />
                  Puente Supabase
                </span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
              </button>
            </div>
          </div>

          {/* LOWER LIVE SYNC STATUS EN AMBIENTE GRIS CLARO */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sheets Live Sync</span>
            </div>
            <p className="text-[10px] text-slate-450 leading-tight font-mono">
              v_db_verse_prod_01<br />
              Último cambio: Hace 2 min
            </p>
          </div>
        </aside>

        {/* 2. MAIN VIEW AREA / CENTRAL SECTION */}
        <main className="grow flex flex-col overflow-hidden bg-slate-50/55">
          {/* DASHBOARD PRINCIPAL HEADER */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-3xs">
            <div>
              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono mr-2">
                Conexión segura SAT/ISO
              </span>
              <span className="text-xs text-slate-500">
                Base de Datos: <strong className={localStorage.getItem('verse_supabase_url') && localStorage.getItem('verse_supabase_key') ? "text-blue-600 font-bold" : "text-amber-600 font-medium"}>
                  {localStorage.getItem('verse_supabase_url') && localStorage.getItem('verse_supabase_key') ? "Supabase Cloud Activa" : "Persistencia Local (Modo Demostración)"}
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
            {activeTab === 'Dashboard' && (
              <Dashboard
                records={records}
                exchangeRate={exchangeRate}
                currentCurrency={currentCurrency}
                role={role}
                isSupabaseConfigured={!!(localStorage.getItem('verse_supabase_url') && localStorage.getItem('verse_supabase_key'))}
                isSupabaseLoading={isSupabaseLoading}
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
                role={role}
                onAddRecord={(nRecord) => {
                  setRecords((prev) => [nRecord, ...prev]);
                  syncCRMRecordToSupabaseIfNeeded(nRecord, 'UPSERT');
                  const sheetUrl = localStorage.getItem('verse_sheet_url') || '';
                  const apiKey = localStorage.getItem('verse_sheet_api_key') || '';
                  const token = localStorage.getItem('verse_sheet_token') || '';
                  if (sheetUrl) {
                    pushToGoogleSheets(sheetUrl, nRecord, 'CREATE', apiKey, token).then(res => {
                      if (res.success) {
                        appendAuditLog('ALTA REGISTRO', `Creó folio ${nRecord.informacion_general_folio} y sincronizó con Google Sheets.`);
                      }
                    });
                  } else {
                    appendAuditLog('ALTA REGISTRO', `Creó folio ${nRecord.informacion_general_folio} de forma local.`);
                  }
                }}
                onUpdateRecord={(uRecord) => {
                  setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                  syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                  const sheetUrl = localStorage.getItem('verse_sheet_url') || '';
                  const apiKey = localStorage.getItem('verse_sheet_api_key') || '';
                  const token = localStorage.getItem('verse_sheet_token') || '';
                  if (sheetUrl) {
                    pushToGoogleSheets(sheetUrl, uRecord, 'UPDATE', apiKey, token).then(res => {
                      if (res.success) {
                        appendAuditLog('MODIFICACIÓN', `Actualizó folio ${uRecord.informacion_general_folio} y sincronizó con Google Sheets.`);
                      }
                    });
                  } else {
                    appendAuditLog('MODIFICACIÓN', `Actualizó folio ${uRecord.informacion_general_folio} de forma local.`);
                  }
                }}
                onDeleteRecord={(delId) => {
                  const targetRecord = records.find(item => item.id === delId);
                  setRecords((prev) => prev.filter((item) => item.id !== delId));
                  if (targetRecord) {
                    syncCRMRecordToSupabaseIfNeeded(targetRecord, 'DELETE');
                    const sheetUrl = localStorage.getItem('verse_sheet_url') || '';
                    const apiKey = localStorage.getItem('verse_sheet_api_key') || '';
                    const token = localStorage.getItem('verse_sheet_token') || '';
                    if (sheetUrl) {
                      pushToGoogleSheets(sheetUrl, targetRecord, 'DELETE', apiKey, token).then(res => {
                        appendAuditLog('ELIMINACIÓN', `Eliminó folio ${targetRecord.informacion_general_folio} y notificó a Google Sheets.`);
                      });
                    } else {
                      appendAuditLog('ELIMINACIÓN', `Eliminó folio ${targetRecord.informacion_general_folio} de forma local.`);
                    }
                  }
                }}
                onShowAudit={appendAuditLog}
              />
            )}

            {activeTab === 'Quotations' && (
              <QuotationsSection records={records} exchangeRate={exchangeRate} />
            )}

            {activeTab === 'PurchaseOrders' && (
              <PurchaseOrdersSection
                records={records}
                role={role}
                onUpdateRecord={(uRecord) => {
                  setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                  syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                  // Trigger sheet support if configured
                  const sheetUrl = localStorage.getItem('verse_sheet_url') || '';
                  const apiKey = localStorage.getItem('verse_sheet_api_key') || '';
                  const token = localStorage.getItem('verse_sheet_token') || '';
                  if (sheetUrl) {
                    pushToGoogleSheets(sheetUrl, uRecord, 'UPDATE', apiKey, token);
                  }
                }}
                onShowAudit={appendAuditLog}
              />
            )}

            {activeTab === 'Contacts' && (
              <ContactsSection
                contacts={contacts}
                role={role}
                onAddContact={(nCon) => {
                  setContacts((prev) => [nCon, ...prev]);
                  syncContactToSupabaseIfNeeded(nCon, 'UPSERT');
                }}
                onDeleteContact={(delId) => {
                  const targetContact = contacts.find(c => c.id === delId);
                  setContacts((prev) => prev.filter((item) => item.id !== delId));
                  if (targetContact) {
                    syncContactToSupabaseIfNeeded(targetContact, 'DELETE');
                  }
                }}
                onShowAudit={appendAuditLog}
              />
            )}

            {activeTab === 'Followups' && (
              <FollowupsSection
                records={records}
                role={role}
                onUpdateRecord={(uRecord) => {
                  setRecords((prev) => prev.map((item) => (item.id === uRecord.id ? uRecord : item)));
                  syncCRMRecordToSupabaseIfNeeded(uRecord, 'UPSERT');
                  const sheetUrl = localStorage.getItem('verse_sheet_url') || '';
                  const apiKey = localStorage.getItem('verse_sheet_api_key') || '';
                  const token = localStorage.getItem('verse_sheet_token') || '';
                  if (sheetUrl) {
                    pushToGoogleSheets(sheetUrl, uRecord, 'UPDATE', apiKey, token);
                  }
                }}
                onShowAudit={appendAuditLog}
              />
            )}

            {activeTab === 'Audit' && (
              <AuditSection logs={auditLogs} role={role} onClearLogs={handleClearLogs} />
            )}

            {activeTab === 'SyncSettings' && (
              <SyncSettingsSection
                role={role}
                onResetDatabase={handleResetDatabase}
                onSyncComplete={async (responseLogs, syncedRecords) => {
                  if (syncedRecords && syncedRecords.length > 0) {
                    setRecords(syncedRecords);
                    
                    // Subir automáticamente a Supabase los nuevos registros sincronizados
                    const url = localStorage.getItem('verse_supabase_url') || '';
                    const key = localStorage.getItem('verse_supabase_key') || '';
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
                  if (syncedRecords && syncedRecords.length > 0) {
                    setRecords(syncedRecords);
                  }
                  if (syncedContacts && syncedContacts.length > 0) {
                    setContacts(syncedContacts);
                  }
                  if (syncedLogs && syncedLogs.length > 0) {
                    setAuditLogs(syncedLogs);
                  }
                }}
                onShowAudit={appendAuditLog}
              />
            )}
          </div>

          {/* LOWER STATUS FOOTER / TECHNICAL AUDIT CONTROL */}
          <footer className="h-10 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0 select-none text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wide">
                  Sincronizado con Google Sheets Live (100% Consistencia)
                </span>
              </div>
              <div className="h-4 w-px bg-slate-200"></div>
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[400px]">
                Bitácora activa: [Operador: geovanni@verse-technology.com] {auditLogs.length > 0 ? `ÚLTIMO: ${auditLogs[0].accion} - ${auditLogs[0].detalles.substring(0, 45)}...` : 'Listo'}
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

      {/* REGISTRO / TOAST NOTIFICATION FLOATING PANEL */}
      {toast.show && (
        <div className="fixed bottom-14 right-5 z-50">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-xs font-semibold ${
            toast.type === 'success' 
              ? 'bg-emerald-950/95 text-white border-emerald-500' 
              : toast.type === 'error'
                ? 'bg-red-950/95 text-white border-red-500 animate-pulse'
                : 'bg-slate-900/95 text-white border-slate-700'
          }`}>
            <span className="w-2 h-2 rounded-full animate-ping bg-white shrink-0 font-bold"></span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
