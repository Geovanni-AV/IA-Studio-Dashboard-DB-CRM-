// src/contexts/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CRMRecord, Contact, PurchaseOrder, AuditLog } from '../types';
import { 
  getSupabaseClient, 
  getResolvedCRMTableName, 
  getResolvedContactsTableName,
  getResolvedOCTableName,
  getResolvedAuditLogsTableName,
  subscribeToTableRealtime, 
  mapRawCRMRecord, 
  mapRawContact, 
  mapRawPurchaseOrder, 
  mapRawAuditLog,
  loadFromSupabase
} from '../supabaseService';

interface DataContextType {
  records: CRMRecord[];
  contacts: Contact[];
  purchaseOrders: PurchaseOrder[];
  auditLogs: AuditLog[];
  setRecords: React.Dispatch<React.SetStateAction<CRMRecord[]>>;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;
  serverConfirmedMutationsRef: React.RefObject<Map<string, number>>;
  registerLocalMutation: (tableOrRecordId: string, action?: 'INSERT' | 'UPDATE' | 'DELETE', maybeRecordId?: string) => string;
  isLocalMutation: (tableOrRecordId: string, action?: 'INSERT' | 'UPDATE' | 'DELETE', maybeRecordId?: string) => boolean;
  preloadAllData: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  isInitialLoading: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void; // 🛡️ Inyección de control visual
}

export const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
  supabaseStatus: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void; // 🛡️ Inyección de control visual
}

export const DataProvider = ({ children, supabaseStatus, showToast }: DataProviderProps) => {
  const [records, setRecords] = useState<CRMRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Mecanismo de control blindado para sincronización de canales cruzados (HTTP vs WebSocket)
  const serverConfirmedMutationsRef = useRef<Map<string, number>>(new Map());
  
  // Variable para verificar si el usuario es responsable de la mutación local
  const localMutationsRef = useRef<{
    id: string;
    timestamp: number;
    table: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    recordId: string;
  }[]>([]);

  const registerLocalMutation = (tableOrRecordId: string, action?: 'INSERT' | 'UPDATE' | 'DELETE', maybeRecordId?: string) => {
    const recordId = maybeRecordId || tableOrRecordId;
    const table = maybeRecordId ? tableOrRecordId : 'any';
    const act = action || 'UPDATE';
    const mutId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const now = Date.now();
    localMutationsRef.current.push({
      id: mutId,
      timestamp: now,
      table,
      action: act,
      recordId
    });
    
    // Auto-limpieza (Garbage Collection) de mutaciones antiguas tras 8 segundos
    setTimeout(() => {
      localMutationsRef.current = localMutationsRef.current.filter(m => Date.now() - m.timestamp < 8000);
    }, 10000);

    return mutId;
  };

  const isLocalMutation = (tableOrRecordId: string, action?: 'INSERT' | 'UPDATE' | 'DELETE', maybeRecordId?: string) => {
    const recordId = maybeRecordId || tableOrRecordId;
    return localMutationsRef.current.some(m => 
      m.recordId === recordId &&
      Date.now() - m.timestamp < 8000
    );
  };

  // Función para inicializar y descargar todo el estado desde Supabase
  const preloadAllData = async (url: string, key: string) => {
    setIsInitialLoading(true);
    try {
      const res = await loadFromSupabase(url, key);
      if (res.success) {
        setRecords(res.records);
        setContacts(res.contacts);
        setAuditLogs(res.auditLogs);
        setPurchaseOrders(res.purchaseOrders);
        return { success: true, message: res.message };
      }
      return { success: false, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || String(err) };
    } finally {
      setIsInitialLoading(false);
    }
  };

  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (supabaseStatus !== 'CONNECTED') return;

    const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('verse_supabase_url') || '';
    const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('verse_supabase_key') || '';
    const supabase = getSupabaseClient(url, key);
    
    if (!supabase) return;

    const channels: any[] = [];

    // 1. ESCUCHA EN TIEMPO REAL: EXPEDIENTES (DB CRM)
    const crmChannel = subscribeToTableRealtime(supabase, getResolvedCRMTableName(), (payload) => {
      const targetId = payload.new?.id || payload.old?.id;
      if (!targetId) return;
      const folio = payload.new?.informacion_general_folio || payload.old?.informacion_general_folio || 'Desconocido';
      
      if (isLocalMutation(targetId)) {
        const now = Date.now();
        serverConfirmedMutationsRef.current.set(targetId, now);
        setTimeout(() => {
          if (serverConfirmedMutationsRef.current.get(targetId) === now) {
            serverConfirmedMutationsRef.current.delete(targetId);
          }
        }, 5000);
      }

      setRecords((prev) => {
        if (payload.eventType === 'INSERT') {
          // UNIFICACIÓN DE DATA DRIFT: Reemplazamos la referencia optimista local por el objeto enriquecido del servidor
          if (prev.some(r => r.id === targetId)) {
            return prev.map(r => r.id === targetId ? mapRawCRMRecord(payload.new) : r);
          }
          // 🛡️ ALERTA ACTIVADA: Solo si la mutación viene de otro usuario remoto
          if (!isLocalMutation(targetId)) showToastRef.current(`📂 Nuevo expediente creado por otro usuario (Folio: ${folio})`, 'info');
          return [mapRawCRMRecord(payload.new), ...prev];
        }
        if (payload.eventType === 'UPDATE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`🔄 El expediente ${folio} fue actualizado por otro usuario`, 'info');
          return prev.map(r => r.id === targetId ? mapRawCRMRecord(payload.new) : r);
        }
        if (payload.eventType === 'DELETE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`🗑️ Un expediente fue eliminado de la base de datos remota`, 'info');
          return prev.filter(r => r.id !== targetId);
        }
        return prev;
      });
    });
    if (crmChannel) channels.push(crmChannel);

    // 2. ESCUCHA EN TIEMPO REAL: CONTACTOS
    const contactsChannel = subscribeToTableRealtime(supabase, getResolvedContactsTableName(), (payload) => {
      const targetId = payload.new?.id || payload.old?.id || payload.new?.ID || payload.old?.ID;
      if (!targetId) return;
      const nombre = payload.new?.nombre || 'Contacto';
      
      if (isLocalMutation(targetId)) {
        const now = Date.now();
        serverConfirmedMutationsRef.current.set(targetId, now);
        setTimeout(() => {
          if (serverConfirmedMutationsRef.current.get(targetId) === now) {
            serverConfirmedMutationsRef.current.delete(targetId);
          }
        }, 5000);
      }

      setContacts((prev) => {
        if (payload.eventType === 'INSERT') {
          if (prev.some(c => c.id === targetId)) {
            return prev.map(c => c.id === targetId ? mapRawContact(payload.new) : c);
          }
          if (!isLocalMutation(targetId)) showToastRef.current(`👤 Nuevo contacto registrado de forma externa: ${nombre}`, 'info');
          return [mapRawContact(payload.new), ...prev];
        }
        if (payload.eventType === 'UPDATE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`👤 Datos de contacto actualizados en red: ${nombre}`, 'info');
          return prev.map(c => c.id === targetId ? mapRawContact(payload.new) : c);
        }
        if (payload.eventType === 'DELETE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`🗑️ Un contacto fue removido del servidor remoto`, 'info');
          return prev.filter(c => c.id !== targetId);
        }
        return prev;
      });
    });
    if (contactsChannel) channels.push(contactsChannel);

    // 3. ESCUCHA EN TIEMPO REAL: ÓRDENES DE COMPRA (DB_OC)
    const ocChannel = subscribeToTableRealtime(supabase, getResolvedOCTableName(), (payload) => {
      const targetId = String(payload.new?.id || payload.old?.id);
      if (!targetId || targetId === 'undefined') return;
      
      if (isLocalMutation(targetId)) {
        const now = Date.now();
        serverConfirmedMutationsRef.current.set(targetId, now);
        setTimeout(() => {
          if (serverConfirmedMutationsRef.current.get(targetId) === now) {
            serverConfirmedMutationsRef.current.delete(targetId);
          }
        }, 5000);
      }

      setPurchaseOrders((prev) => {
        if (payload.eventType === 'INSERT') {
          if (prev.some(o => String(o.id) === targetId)) {
            return prev.map(o => String(o.id) === targetId ? mapRawPurchaseOrder(payload.new) : o);
          }
          if (!isLocalMutation(targetId)) showToastRef.current(`📦 Nueva orden de compra registrada de forma externa`, 'info');
          return [mapRawPurchaseOrder(payload.new), ...prev];
        }
        if (payload.eventType === 'UPDATE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`📦 Orden de compra actualizada por otro usuario`, 'info');
          return prev.map(o => String(o.id) === targetId ? mapRawPurchaseOrder(payload.new) : o);
        }
        if (payload.eventType === 'DELETE') {
          if (!isLocalMutation(targetId)) showToastRef.current(`🗑️ Una orden de compra fue removida del servidor remoto`, 'info');
          return prev.filter(o => String(o.id) !== targetId);
        }
        return prev;
      });
    });
    if (ocChannel) channels.push(ocChannel);

    // 4. ESCUCHA EN TIEMPO REAL: BITÁCORA REMOTA ACID
    // Cola provisional en memoria (Buffer) para retener logs entrantes en ráfaga
    let auditBuffer: AuditLog[] = [];
    let throttleTimeout: any = null;

    const auditChannel = subscribeToTableRealtime(supabase, getResolvedAuditLogsTableName() || 'audit_logs', (payload) => {
      if (payload.eventType === 'INSERT') {
        const mappedLog = mapRawAuditLog(payload.new);
        auditBuffer.push(mappedLog);

        // 🛡️ ESTRANGULAMIENTO ANTIFLOODING: Agrupamos y renderizamos en lote cada 800ms
        if (!throttleTimeout) {
          throttleTimeout = setTimeout(() => {
            setAuditLogs((prev) => {
              // Fusionamos el lote retenido al inicio del arreglo maestro de RAM
              const uniqueBuffer = auditBuffer.filter(log => !prev.some(p => p.id === log.id));
              const updatedLogs = [...uniqueBuffer, ...prev].slice(0, 50);
              auditBuffer = []; // Vaciamos el buffer provisional
              return updatedLogs;
            });
            throttleTimeout = null; // Liberamos el cerrojo para el siguiente lote
          }, 800);
        }
      }
    });
    if (auditChannel) channels.push(auditChannel);

    // Desmontaje estricto de suscripciones para evitar memory leaks en Strict Mode
    return () => {
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      channels.forEach(channel => {
        if (channel) {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.warn("Failed to unsubscribe channel directly:", e);
          }
        }
      });
    };
  }, [supabaseStatus]);

  return (
    <DataContext.Provider value={{
      records, contacts, purchaseOrders, auditLogs, setRecords, setContacts, setPurchaseOrders, setAuditLogs,
      serverConfirmedMutationsRef, registerLocalMutation, isLocalMutation, preloadAllData, isInitialLoading,
      showToast
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData debe ser usado dentro de un DataProvider");
  return context;
};
