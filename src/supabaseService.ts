import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CRMRecord, Contact, AuditLog } from './types';

// Deterministic UUID converter for type-safe Supabase ID mapping
export function toValidUUID(str: string): string {
  if (!str) return '00000000-0000-4000-a000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }

  let hash1 = 0;
  let hash2 = 0;
  let hash3 = 0;
  let hash4 = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 * 31 + ch) | 0;
    hash2 = (hash2 * 17 + ch) | 0;
    hash3 = (hash3 * 13 + ch) | 0;
    hash4 = (hash4 * 7 + ch) | 0;
  }

  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(4, '0');
  const hex3 = Math.abs(hash3).toString(16).padStart(4, '0');
  const hex4 = Math.abs(hash4).toString(16).padStart(4, '0');
  const hex5 = Math.abs(hash1 ^ hash2 ^ hash3 ^ hash4).toString(16).padStart(12, '0');

  const part1 = hex1.substring(0, 8);
  const part2 = hex2.substring(0, 4);
  const part3 = '4' + hex3.substring(0, 3);
  const part4 = 'a' + hex4.substring(0, 3);
  const part5 = hex5.substring(0, 12);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}

// State helper to determine if Supabase is active
export interface SupabaseConfig {
  url: string;
  key: string;
  autoSync: boolean;
  enabled: boolean;
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

// Dynamic Table Name Resolution
let resolvedCRMTableName: string | null = null;
let resolvedContactsTableName: string | null = null;
let resolvedAuditLogsTableName: string | null = null;

let knownCRMTableColumns: string[] = [];
let knownContactsColumns: string[] = [];
let knownAuditLogsColumns: string[] = [];

const CRM_TABLE_CANDIDATES = ['DB CRM', 'DB_CRM', 'db_crm', 'crm_records'];
const CONTACTS_TABLE_CANDIDATES = ['contacts', 'contactos', 'CONTACTS'];
const AUDIT_LOGS_TABLE_CANDIDATES = ['audit_logs', 'bitacora', 'AUDIT_LOGS', 'audit_log'];

export function getResolvedCRMTableName(): string {
  return resolvedCRMTableName || 'crm_records';
}
export function getResolvedContactsTableName(): string {
  return resolvedContactsTableName || 'contacts';
}
export function getResolvedAuditLogsTableName(): string {
  return resolvedAuditLogsTableName || 'audit_logs';
}

/**
 * Probes the Supabase database to dynamically resolve actual table names
 */
export async function probeTables(url: string, key: string, forceReset = false) {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  if (forceReset || cachedUrl !== cleanUrl || cachedKey !== cleanKey) {
    resolvedCRMTableName = null;
    resolvedContactsTableName = null;
    resolvedAuditLogsTableName = null;
    knownCRMTableColumns = [];
    knownContactsColumns = [];
    knownAuditLogsColumns = [];
    cachedUrl = cleanUrl;
    cachedKey = cleanKey;
  }

  const headers = {
    'apikey': cleanKey,
    'Authorization': `Bearer ${cleanKey}`,
    'Content-Type': 'application/json'
  };

  // Probe CRM records table
  if (!resolvedCRMTableName) {
    for (const cand of CRM_TABLE_CANDIDATES) {
      try {
        const encoded = encodeURIComponent(cand);
        const res = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=id&limit=1`, { headers, method: 'GET' });
        if (res.ok) {
          resolvedCRMTableName = cand;
          const resFull = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=*&limit=1`, { headers, method: 'GET' });
          if (resFull.ok) {
            const rows = await resFull.json();
            if (rows && rows.length > 0) {
              knownCRMTableColumns = Object.keys(rows[0]);
            }
          }
          break;
        }
      } catch (e) {}
    }
    // Fallback search with SDK
    if (!resolvedCRMTableName) {
      const client = getSupabaseClient(url, key);
      if (client) {
        for (const cand of CRM_TABLE_CANDIDATES) {
          try {
            const { error } = await client.from(cand).select('id').limit(1);
            if (!error) {
              resolvedCRMTableName = cand;
              const { data } = await client.from(cand).select('*').limit(1);
              if (data && data.length > 0) {
                knownCRMTableColumns = Object.keys(data[0]);
              }
              break;
            }
          } catch (e) {}
        }
      }
    }
    if (!resolvedCRMTableName) {
      resolvedCRMTableName = 'crm_records';
    }
  }

  // Probe Contacts table
  if (!resolvedContactsTableName) {
    for (const cand of CONTACTS_TABLE_CANDIDATES) {
      try {
        const encoded = encodeURIComponent(cand);
        const res = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=id&limit=1`, { headers, method: 'GET' });
        if (res.ok) {
          resolvedContactsTableName = cand;
          const resFull = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=*&limit=1`, { headers, method: 'GET' });
          if (resFull.ok) {
            const rows = await resFull.json();
            if (rows && rows.length > 0) {
              knownContactsColumns = Object.keys(rows[0]);
            }
          }
          break;
        }
      } catch (e) {}
    }
    if (!resolvedContactsTableName) {
      resolvedContactsTableName = 'contacts';
    }
  }

  // Probe Audit Logs table
  if (!resolvedAuditLogsTableName) {
    for (const cand of AUDIT_LOGS_TABLE_CANDIDATES) {
      try {
        const encoded = encodeURIComponent(cand);
        const res = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=id&limit=1`, { headers, method: 'GET' });
        if (res.ok) {
          resolvedAuditLogsTableName = cand;
          const resFull = await fetch(`${cleanUrl}/rest/v1/${encoded}?select=*&limit=1`, { headers, method: 'GET' });
          if (resFull.ok) {
            const rows = await resFull.json();
            if (rows && rows.length > 0) {
              knownAuditLogsColumns = Object.keys(rows[0]);
            }
          }
          break;
        }
      } catch (e) {}
    }
    if (!resolvedAuditLogsTableName) {
      resolvedAuditLogsTableName = 'audit_logs';
    }
  }
}

export function getSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  let cleanUrl = url.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  const cleanKey = key.trim();

  // Return cached client if config has not changed
  if (cachedClient && cachedUrl === cleanUrl && cachedKey === cleanKey) {
    return cachedClient;
  }

  try {
    cachedUrl = cleanUrl;
    cachedKey = cleanKey;
    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false
      }
    });
    return cachedClient;
  } catch (error) {
    console.error('Error al inicializar el cliente de Supabase:', error);
    return null;
  }
}

/**
 * Tests connection to Supabase and checks if tables exist
 */
export async function testSupabaseConnection(url: string, key: string): Promise<{
  success: boolean;
  message: string;
  rawError?: any;
  tablesDetected: { records: boolean; contacts: boolean; logs: boolean };
}> {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  if (!cleanUrl || !cleanKey) {
    return {
      success: false,
      message: 'Por favor, ingrese URL y Key.',
      tablesDetected: { records: false, contacts: false, logs: false }
    };
  }

  try {
    await probeTables(url, key, true);
  } catch (err: any) {
    console.warn("Probe during connection test failed", err);
  }

  const status = { records: false, contacts: false, logs: false };
  let testedSuccessfully = false;
  let lastError: any = null;

  const headers = {
    'apikey': cleanKey,
    'Authorization': `Bearer ${cleanKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const crmTableEncoded = encodeURIComponent(getResolvedCRMTableName());
    const contactsTableEncoded = encodeURIComponent(getResolvedContactsTableName());
    const auditTableEncoded = encodeURIComponent(getResolvedAuditLogsTableName());

    const [resRec, resCon, resAud] = await Promise.all([
      fetch(`${cleanUrl}/rest/v1/${crmTableEncoded}?select=id&limit=1`, { headers, method: 'GET' }),
      fetch(`${cleanUrl}/rest/v1/${contactsTableEncoded}?select=id&limit=1`, { headers, method: 'GET' }),
      fetch(`${cleanUrl}/rest/v1/${auditTableEncoded}?select=id&limit=1`, { headers, method: 'GET' })
    ]);

    status.records = resRec.ok;
    status.contacts = resCon.ok;
    status.logs = resAud.ok;
    testedSuccessfully = resRec.ok && resCon.ok && resAud.ok;

    if (!resRec.ok) {
      lastError = { message: `Fallo con la tabla ${getResolvedCRMTableName()}: HTTP ${resRec.status}`, status: resRec.status };
    } else if (!resCon.ok) {
      lastError = { message: `Fallo con la tabla ${getResolvedContactsTableName()}: HTTP ${resCon.status}`, status: resCon.status };
    } else if (!resAud.ok) {
      lastError = { message: `Fallo con la tabla ${getResolvedAuditLogsTableName()}: HTTP ${resAud.status}`, status: resAud.status };
    }
  } catch (err: any) {
    lastError = err;
    console.warn("REST connection test failed. Checking SDK...", err);
  }

  if (!testedSuccessfully) {
    const client = getSupabaseClient(url, key);
    if (!client) {
      return {
        success: false,
        message: `No se pudo conectar a Supabase. Error: ${lastError?.message || lastError}`,
        rawError: lastError,
        tablesDetected: status
      };
    }

    try {
      const { error: recErr, data: recData } = await client.from(getResolvedCRMTableName()).select('*').limit(1);
      status.records = !recErr;
      if (recData && recData.length > 0 && knownCRMTableColumns.length === 0) {
        knownCRMTableColumns = Object.keys(recData[0]);
      }

      const { error: conErr, data: conData } = await client.from(getResolvedContactsTableName()).select('*').limit(1);
      status.contacts = !conErr;
      if (conData && conData.length > 0 && knownContactsColumns.length === 0) {
        knownContactsColumns = Object.keys(conData[0]);
      }

      const { error: audErr, data: audData } = await client.from(getResolvedAuditLogsTableName()).select('*').limit(1);
      status.logs = !audErr;
      if (audData && audData.length > 0 && knownAuditLogsColumns.length === 0) {
        knownAuditLogsColumns = Object.keys(audData[0]);
      }

      testedSuccessfully = true;
      if (recErr) lastError = recErr;
      else if (conErr) lastError = conErr;
      else if (audErr) lastError = audErr;
    } catch (e: any) {
      lastError = e;
    }
  }

  const allConnected = status.records && status.contacts && status.logs;
  if (allConnected) {
    return {
      success: true,
      message: `¡Conexión exitosa! Las 3 tablas fueron detectadas y mapeadas correctamente: "${getResolvedCRMTableName()}", "${getResolvedContactsTableName()}", "${getResolvedAuditLogsTableName()}".`,
      tablesDetected: status
    };
  } else {
    return {
      success: true, 
      message: `¡Conectado exitosamente con Supabase! Sin embargo, faltan una o más de las tablas requeridas. Usando: crm_records="${getResolvedCRMTableName()}" (${status.records ? '✓ Detectada' : '✗ Faltante'}), contactos="${getResolvedContactsTableName()}" (${status.contacts ? '✓ Detectada' : '✗ Faltante'}), bitácora="${getResolvedAuditLogsTableName()}" (${status.logs ? '✓ Detectada' : '✗ Faltante'}).`,
      rawError: lastError,
      tablesDetected: status
    };
  }
}

/**
 * Flexible columnar value helper to map uppercase, lowercase, spaces, or camelCase keys
 */
function getFlexibleValue(r: any, keys: string[], fallback: any = ''): any {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) {
      return r[k];
    }
  }
  for (const k of keys) {
    const normK = k.toLowerCase().replace(/[\s_-]/g, '');
    for (const rawKey of Object.keys(r)) {
      const normRawKey = rawKey.toLowerCase().replace(/[\s_-]/g, '');
      if (normRawKey === normK) {
        if (r[rawKey] !== undefined && r[rawKey] !== null) {
          return r[rawKey];
        }
      }
    }
  }
  return fallback;
}

export function mapRawCRMRecord(r: any): CRMRecord {
  const hardware = Number(getFlexibleValue(r, ['total_hardware_cotizacion', 'hardware', 'Hardware'])) || 0;
  const servicios = Number(getFlexibleValue(r, ['total_servicios_cotizacion', 'servicios', 'servicio', 'Servicios'])) || 0;
  
  const dbSubtotal = Number(getFlexibleValue(r, ['total_subtotal_cotizacion', 'subtotal', 'Subtotal'])) || 0;
  const dbIva = Number(getFlexibleValue(r, ['total_iva_cotizacion', 'iva', 'IVA'])) || 0;
  const dbGeneral = Number(getFlexibleValue(r, ['total_general_cotizacion', 'total', 'Total', 'general_cotizacion'])) || 0;

  const subtotal = dbSubtotal > 0 ? dbSubtotal : (hardware + servicios);
  const iva = dbIva > 0 ? dbIva : parseFloat((subtotal * 0.16).toFixed(2));
  const general = dbGeneral > 0 ? dbGeneral : parseFloat((subtotal + iva).toFixed(2));

  const rawAcciones = getFlexibleValue(r, ['acciones_seguimiento', 'acciones', 'acciones_seguimiento'], []);
  let acciones_parsed: any[] = [];
  if (Array.isArray(rawAcciones)) {
    acciones_parsed = rawAcciones;
  } else if (typeof rawAcciones === 'string' && rawAcciones.trim() !== '') {
    try {
      acciones_parsed = JSON.parse(rawAcciones);
    } catch (e) {
      console.warn('Error al parsear acciones_seguimiento:', e);
      acciones_parsed = [];
    }
  }

  const rawMoneda = String(getFlexibleValue(r, ['informacion_general_moneda', 'moneda', 'Moneda'], 'USD')).toUpperCase();
  const moneda = (rawMoneda === 'MXN' ? 'MXN' : 'USD') as 'USD' | 'MXN';

  const rawStatus = String(getFlexibleValue(r, ['status_proyecto', 'status', 'Status', 'estado', 'Estado', 'status_proyecto'], 'Propuesta')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const detectedFolioOc = String(getFlexibleValue(r, ['folio_orden_compra', 'folio_oc', 'folio oc', 'Folio OC', 'folio_orden_compra'], ''));
  let finalStatus: 'Propuesta' | 'Negociación' | 'Cerrado Ganado' = 'Propuesta';
  if (rawStatus.includes('ganado') || rawStatus.includes('cerrado') || detectedFolioOc !== '') {
    finalStatus = 'Cerrado Ganado';
  } else if (rawStatus.includes('negociacion') || rawStatus.includes('negotiation') || rawStatus.includes('proceso')) {
    finalStatus = 'Negociación';
  } else {
    finalStatus = 'Propuesta';
  }

  const rawInstalacion = getFlexibleValue(r, ['informacion_general_instalacion_incluida', 'instalacion_incluida', 'instalacion incluida', 'instalacion'], false);
  const instalacion = rawInstalacion === true || rawInstalacion === 'true' || rawInstalacion === 't' || rawInstalacion === 1 || rawInstalacion === '1';

  return {
    id: toValidUUID(String(getFlexibleValue(r, ['id', 'ID', '_id', 'informacion_general_folio', 'folio', 'Folio']) || '')),
    informacion_general_folio: getFlexibleValue(r, ['informacion_general_folio', 'folio', 'Folio']) || 'S/F',
    fecha_registro: getFlexibleValue(r, ['informacion_general_fecha', 'fecha_registro', 'fecha registro', 'fecha', 'registro', 'Fecha Registro']) || new Date().toISOString().split('T')[0],
    informacion_general_cliente: getFlexibleValue(r, ['informacion_general_cliente', 'cliente', 'Cliente']) || 'Desconocido',
    informacion_general_planta: getFlexibleValue(r, ['informacion_general_planta', 'planta', 'Planta']) || 'Principal',
    cliente_pais: getFlexibleValue(r, ['cliente_pais', 'pais', 'Pais', 'country']) || 'México',
    cliente_ubicacion: getFlexibleValue(r, ['cliente_ubicacion', 'ubicacion', 'Ubicacion', 'ciudad', 'location']) || '',
    informacion_general_proyecto: getFlexibleValue(r, ['informacion_general_proyecto', 'proyecto', 'Proyecto']) || 'Nuevo Proyecto',
    informacion_general_link_cotizacion: getFlexibleValue(r, ['informacion_general_link_cotizacion', 'link_cotizacion', 'link cotizacion', 'Link Cotizacion', 'cotizacion']) || '',
    total_hardware_cotizacion: hardware,
    total_servicios_cotizacion: servicios,
    total_subtotal_cotizacion: subtotal,
    total_iva_cotizacion: iva,
    total_general_cotizacion: general,
    informacion_general_moneda: moneda,
    status_proyecto: finalStatus,
    folio_orden_compra: detectedFolioOc || undefined,
    link_orden_compra: getFlexibleValue(r, ['link_orden_compra', 'link_oc', 'link oc', 'Link OC', 'link_orden_compra']) || undefined,
    fecha_inicio_proyecto: getFlexibleValue(r, ['fecha_inicio_proyecto', 'fecha_inicio', 'fecha inicio', 'Fecha Inicio']) || undefined,
    informacion_general_instalacion_incluida: instalacion,
    notas_comerciales: getFlexibleValue(r, ['notas_comerciales', 'notas', 'Notas', 'notas_comerciales']) || '',
    acciones_seguimiento: acciones_parsed,
    sustituye_folio_anterior: getFlexibleValue(r, ['sustituye_folio_anterior', 'sustituye', 'sustituye_folio_anterior']) || undefined,
    prioridad_nivel: getFlexibleValue(r, ['prioridad_nivel', 'prioridad', 'Prioridad', 'prioridad_nivel']) || 'Warm'
  };
}

export function mapRawContact(c: any): Contact {
  const esEnlaceComercialVal = getFlexibleValue(c, ['esEnlaceComercial', 'esenlacecomercial', 'es_enlace_comercial'], false);
  const isEnlace = esEnlaceComercialVal === true || esEnlaceComercialVal === 'true' || esEnlaceComercialVal === 't' || esEnlaceComercialVal === 1 || esEnlaceComercialVal === '1';

  return {
    id: getFlexibleValue(c, ['id', 'ID', '_id']) || `con_${Math.random().toString(36).substr(2, 9)}`,
    nombre: getFlexibleValue(c, ['nombre', 'Nombre']) || '',
    puesto: getFlexibleValue(c, ['puesto', 'Puesto']) || '',
    cliente: getFlexibleValue(c, ['cliente', 'Cliente']) || '',
    planta: getFlexibleValue(c, ['planta', 'Planta']) || '',
    email: getFlexibleValue(c, ['email', 'Email']) || '',
    telefono: getFlexibleValue(c, ['telefono', 'Telefono']) || '',
    esEnlaceComercial: isEnlace
  };
}

export function mapRawAuditLog(l: any): AuditLog {
  return {
    id: getFlexibleValue(l, ['id', 'ID', '_id']) || `aud_${Math.random().toString(36).substr(2, 9)}`,
    fecha: getFlexibleValue(l, ['fecha', 'Fecha']) || new Date().toISOString().replace('T', ' ').substring(0, 19),
    accion: getFlexibleValue(l, ['accion', 'Accion']) || 'MODIFICACIÓN',
    operador: getFlexibleValue(l, ['operador', 'Operador']) || 'sistema',
    perfil: getFlexibleValue(l, ['perfil', 'Perfil']) || 'Solo Lectura',
    detalles: getFlexibleValue(l, ['detalles', 'Detalles']) || ''
  };
}

/**
 * Load all databases from Supabase
 */
export async function loadFromSupabase(url: string, key: string): Promise<{
  success: boolean;
  records: CRMRecord[];
  contacts: Contact[];
  auditLogs: AuditLog[];
  message: string;
  rawError?: any;
}> {
  let cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  try {
    await probeTables(url, key, true);
  } catch (err) {
    console.warn("Probe during load failed", err);
  }

  const crmTable = getResolvedCRMTableName();
  const contactsTable = getResolvedContactsTableName();
  const auditLogsTable = getResolvedAuditLogsTableName();

  let recData: any[] = [];
  let conData: any[] = [];
  let audData: any[] = [];
  let fetchedViaRest = false;
  let restErrorMsg = '';

  // 1. INTENTAR PRIMERO VÍA REST HTTP DIRECTA (Inmune a bloqueadores de cookies/GoTrue de iframes)
  try {
    const headers = {
      'apikey': cleanKey,
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    };

    const crmTableEncoded = encodeURIComponent(crmTable);
    const contactsTableEncoded = encodeURIComponent(contactsTable);
    const auditLogsTableEncoded = encodeURIComponent(auditLogsTable);

    const [resRec, resCon, resAud] = await Promise.all([
      fetch(`${cleanUrl}/rest/v1/${crmTableEncoded}?select=*`, { headers, method: 'GET' }),
      fetch(`${cleanUrl}/rest/v1/${contactsTableEncoded}?select=*`, { headers, method: 'GET' }),
      fetch(`${cleanUrl}/rest/v1/${auditLogsTableEncoded}?select=*`, { headers, method: 'GET' })
    ]);

    if (resRec.ok && resCon.ok && resAud.ok) {
      recData = await resRec.json();
      conData = await resCon.json();
      audData = await resAud.json();
      fetchedViaRest = true;

      // Update known columns
      if (recData.length > 0) knownCRMTableColumns = Object.keys(recData[0]);
      if (conData.length > 0) knownContactsColumns = Object.keys(conData[0]);
      if (audData.length > 0) knownAuditLogsColumns = Object.keys(audData[0]);
    } else {
      restErrorMsg = `REST HTTP statuses: ${crmTable}=${resRec.status}, ${contactsTable}=${resCon.status}, ${auditLogsTable}=${resAud.status}`;
    }
  } catch (err: any) {
    restErrorMsg = err.message || String(err);
    console.warn("REST direct fetch failed. Falling back to Supabase SDK client...", err);
  }

  // 2. FALLBACK AL CLIENTE SDK OFICIAL SI LA LLAMADA REST HTTP DIRECTA NO TUVO ÉXITO
  if (!fetchedViaRest) {
    const client = getSupabaseClient(url, key);
    if (!client) {
      return { 
        success: false, 
        records: [], 
        contacts: [], 
        auditLogs: [], 
        message: `Cliente Supabase no inicializado. Detalle del fallo REST: ${restErrorMsg}` 
      };
    }

    try {
      const { data: sdkRec, error: recErr } = await client
        .from(crmTable)
        .select('*');

      if (recErr) throw new Error(`${crmTable} SDK: ${recErr.message || JSON.stringify(recErr)}`);

      const { data: sdkCon, error: conErr } = await client
        .from(contactsTable)
        .select('*');

      if (conErr) throw new Error(`${contactsTable} SDK: ${conErr.message || JSON.stringify(conErr)}`);

      const { data: sdkAud, error: audErr } = await client
        .from(auditLogsTable)
        .select('*');

      if (audErr) throw new Error(`${auditLogsTable} SDK: ${audErr.message || JSON.stringify(audErr)}`);

      recData = sdkRec || [];
      conData = sdkCon || [];
      audData = sdkAud || [];

      if (recData.length > 0) knownCRMTableColumns = Object.keys(recData[0]);
      if (conData.length > 0) knownContactsColumns = Object.keys(conData[0]);
      if (audData.length > 0) knownAuditLogsColumns = Object.keys(audData[0]);
    } catch (sdkError: any) {
      return {
        success: false,
        records: [],
        contacts: [],
        auditLogs: [],
        message: `Error al importar datos en ambos canales (REST & SDK). REST: ${restErrorMsg} | SDK: ${sdkError.message}`,
        rawError: sdkError
      };
    }
  }

  // 3. MAPEO Y NORMALIZACIÓN DE DATOS (Mismo algoritmo de cálculo y des-serialización de JSON)
  try {
    const records: CRMRecord[] = recData.map(mapRawCRMRecord);
    records.sort((a, b) => (b.fecha_registro || '').localeCompare(a.fecha_registro || '') || (b.id || '').localeCompare(a.id || ''));

    const contacts: Contact[] = conData.map(mapRawContact);
    contacts.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    const auditLogs: AuditLog[] = audData.map(mapRawAuditLog);
    auditLogs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    const originIndicator = fetchedViaRest ? "Canal REST Directo HTTP" : "Software Development Kit (SDK) Fallback";

    return {
      success: true,
      records,
      contacts,
      auditLogs,
      message: `¡Carga consolidada exitosa! Se importaron ${records.length} expedientes, ${contacts.length} contactos y ${auditLogs.length} logs vía "${getResolvedCRMTableName()}", "${getResolvedContactsTableName()}" y "${getResolvedAuditLogsTableName()}" [${originIndicator}].`
    };

  } catch (error: any) {
    return {
      success: false,
      records: [],
      contacts: [],
      auditLogs: [],
      message: `Error al procesar el mapeo de datos de Supabase: ${error.message}`
    };
  }
}

/**
 * Pushes/Upserts a single CRMRecord to Supabase crm_records
 */
export async function pushCRMRecordToSupabase(
  url: string,
  key: string,
  record: CRMRecord
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const hardware = Number(record.total_hardware_cotizacion) || 0;
    const servicios = Number(record.total_servicios_cotizacion) || 0;
    const subtotal = hardware + servicios;
    const iva = parseFloat((subtotal * 0.16).toFixed(2));
    const general = parseFloat((subtotal + iva).toFixed(2));

    const validUUID = toValidUUID(record.id);

    const standardPayload: any = {
      id: validUUID,
      informacion_general_folio: record.informacion_general_folio,
      fecha_registro: record.fecha_registro,
      informacion_general_fecha: record.fecha_registro,
      informacion_general_cliente: record.informacion_general_cliente,
      informacion_general_planta: record.informacion_general_planta,
      cliente_pais: record.cliente_pais,
      cliente_ubicacion: record.cliente_ubicacion,
      informacion_general_proyecto: record.informacion_general_proyecto,
      informacion_general_link_cotizacion: record.informacion_general_link_cotizacion,
      total_hardware_cotizacion: hardware,
      total_servicios_cotizacion: servicios,
      total_subtotal_cotizacion: subtotal,
      total_iva_cotizacion: iva,
      total_general_cotizacion: general,
      informacion_general_moneda: record.informacion_general_moneda,
      status_proyecto: record.status_proyecto,
      folio_orden_compra: record.folio_orden_compra || null,
      link_orden_compra: record.link_orden_compra || null,
      fecha_inicio_proyecto: record.fecha_inicio_proyecto || null,
      informacion_general_instalacion_incluida: record.informacion_general_instalacion_incluida ?? null,
      notas_comerciales: record.notas_comerciales,
      acciones_seguimiento: record.acciones_seguimiento,
      sustituye_folio_anterior: record.sustituye_folio_anterior || null,
      prioridad_nivel: record.prioridad_nivel || null
    };

    const shortPayload: any = {
      id: validUUID,
      folio: record.informacion_general_folio,
      fecha_registro: record.fecha_registro,
      informacion_general_fecha: record.fecha_registro,
      cliente: record.informacion_general_cliente,
      planta: record.informacion_general_planta,
      pais: record.cliente_pais,
      ubicacion: record.cliente_ubicacion,
      proyecto: record.informacion_general_proyecto,
      link_cotizacion: record.informacion_general_link_cotizacion,
      hardware: hardware,
      servicios: servicios,
      subtotal: subtotal,
      iva: iva,
      total: general,
      moneda: record.informacion_general_moneda,
      status: record.status_proyecto,
      folio_oc: record.folio_orden_compra || null,
      link_oc: record.link_orden_compra || null,
      fecha_inicio: record.fecha_inicio_proyecto || null,
      instalacion: record.informacion_general_instalacion_incluida ?? null,
      notas: record.notas_comerciales,
      acciones: record.acciones_seguimiento,
      sustituye: record.sustituye_folio_anterior || null,
      prioridad: record.prioridad_nivel || null
    };

    const payload: any = { id: validUUID };

    if (knownCRMTableColumns.length > 0) {
      for (const col of knownCRMTableColumns) {
        if (col === 'id') continue;
        if (standardPayload[col] !== undefined) {
          payload[col] = standardPayload[col];
        } else if (shortPayload[col] !== undefined) {
          payload[col] = shortPayload[col];
        } else {
          // Normalize column key matching standard/short payload keys
          const normCol = col.toLowerCase().replace(/[\s_-]/g, '');
          let matched = false;
          for (const k of Object.keys(standardPayload)) {
            if (k.toLowerCase().replace(/[\s_-]/g, '') === normCol) {
              payload[col] = standardPayload[k];
              matched = true;
              break;
            }
          }
          if (!matched) {
            for (const k of Object.keys(shortPayload)) {
              if (k.toLowerCase().replace(/[\s_-]/g, '') === normCol) {
                payload[col] = shortPayload[k];
                matched = true;
                break;
              }
            }
          }
        }
      }
    } else {
      // Empty table fallback: check resolved table name
      const targetTable = getResolvedCRMTableName();
      const useStandard = targetTable === 'crm_records' || targetTable === 'DB CRM' || targetTable === 'DB_CRM' || targetTable === 'db_crm';
      const sourcePayload = useStandard ? standardPayload : shortPayload;
      Object.assign(payload, sourcePayload);
    }

    const { error } = await client
      .from(getResolvedCRMTableName())
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error al subir expediente a Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al subir a Supabase:', err);
    return false;
  }
}

/**
 * Deletes a single CRMRecord from Supabase
 */
export async function deleteCRMRecordFromSupabase(
  url: string,
  key: string,
  recordId: string
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const { error } = await client
      .from(getResolvedCRMTableName())
      .delete()
      .eq('id', toValidUUID(recordId));

    if (error) {
      console.error('Error al eliminar expediente de Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al eliminar en Supabase:', err);
    return false;
  }
}

/**
 * Pushes/Upserts a single Contact to Supabase contacts
 */
export async function pushContactToSupabase(
  url: string,
  key: string,
  contact: Contact
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const standardPayload: any = {
      id: contact.id,
      nombre: contact.nombre,
      puesto: contact.puesto,
      cliente: contact.cliente,
      planta: contact.planta,
      email: contact.email,
      telefono: contact.telefono,
      esEnlaceComercial: contact.esEnlaceComercial
    };

    const payload: any = { id: contact.id };

    if (knownContactsColumns.length > 0) {
      for (const col of knownContactsColumns) {
        if (col === 'id') continue;
        if (standardPayload[col] !== undefined) {
          payload[col] = standardPayload[col];
        } else {
          // Normalize column key
          const normCol = col.toLowerCase().replace(/[\s_-]/g, '');
          for (const k of Object.keys(standardPayload)) {
            if (k.toLowerCase().replace(/[\s_-]/g, '') === normCol) {
              payload[col] = standardPayload[k];
              break;
            }
          }
        }
      }
    } else {
      Object.assign(payload, standardPayload);
    }

    const { error } = await client
      .from(getResolvedContactsTableName())
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error al subir contacto a Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al subir contacto:', err);
    return false;
  }
}

/**
 * Deletes a Contact from Supabase
 */
export async function deleteContactFromSupabase(
  url: string,
  key: string,
  contactId: string
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const { error } = await client
      .from(getResolvedContactsTableName())
      .delete()
      .eq('id', contactId);

    if (error) {
      console.error('Error al eliminar contacto de Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red en eliminar contacto:', err);
    return false;
  }
}

/**
 * Pushes/Upserts a single AuditLog to Supabase audit_logs
 */
export async function pushAuditLogToSupabase(
  url: string,
  key: string,
  log: AuditLog
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const standardPayload: any = {
      id: log.id,
      fecha: log.fecha,
      accion: log.accion,
      operador: log.operador,
      perfil: log.perfil,
      detalles: log.detalles
    };

    const payload: any = { id: log.id };

    if (knownAuditLogsColumns.length > 0) {
      for (const col of knownAuditLogsColumns) {
        if (col === 'id') continue;
        if (standardPayload[col] !== undefined) {
          payload[col] = standardPayload[col];
        } else {
          const normCol = col.toLowerCase().replace(/[\s_-]/g, '');
          for (const k of Object.keys(standardPayload)) {
            if (k.toLowerCase().replace(/[\s_-]/g, '') === normCol) {
              payload[col] = standardPayload[k];
              break;
            }
          }
        }
      }
    } else {
      Object.assign(payload, standardPayload);
    }

    const { error } = await client
      .from(getResolvedAuditLogsTableName())
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error al subir audit_log a Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al registrar log:', err);
    return false;
  }
}

/**
 * Publishes/Saves entire local state to Supabase (creates missing entries or overwrites all)
 */
export async function bulkUploadToSupabase(
  url: string,
  key: string,
  records: CRMRecord[],
  contacts: Contact[],
  auditLogs: AuditLog[]
): Promise<{ success: boolean; message: string; rawError?: any }> {
  const client = getSupabaseClient(url, key);
  if (!client) return { success: false, message: 'Cliente Supabase no configurado.' };

  try {
    await probeTables(url, key);
  } catch (err) {
    console.warn("Probe during bulk upload failed", err);
  }

  try {
    let recCount = 0;
    let conCount = 0;
    let audCount = 0;

    for (const rec of records) {
      const ok = await pushCRMRecordToSupabase(url, key, rec);
      if (ok) recCount++;
    }

    for (const con of contacts) {
      const ok = await pushContactToSupabase(url, key, con);
      if (ok) conCount++;
    }

    for (const aud of auditLogs) {
      const ok = await pushAuditLogToSupabase(url, key, aud);
      if (ok) audCount++;
    }

    return {
      success: true,
      message: `Exportación consolidada exitosa. Se subieron ${recCount}/${records.length} expedientes a "${getResolvedCRMTableName()}", ${conCount}/${contacts.length} contactos a "${getResolvedContactsTableName()}" y ${audCount}/${auditLogs.length} logs a "${getResolvedAuditLogsTableName()}".`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error al realizar carga masiva: ${error.message}`,
      rawError: error
    };
  }
}

export const SUPABASE_SQL_INSTRUCTIONS = `-- COPIA Y PEGA ESTE SCRIPT EN EL EDITOR SQL (SQL EDITOR) DE TU PROYECTO SUPABASE

-- 1. Tabla de Expedientes CRM
create table if not exists crm_records (
  id text primary key,
  informacion_general_folio text,
  fecha_registro text,
  informacion_general_cliente text,
  informacion_general_planta text,
  cliente_pais text,
  cliente_ubicacion text,
  informacion_general_proyecto text,
  informacion_general_link_cotizacion text,
  total_hardware_cotizacion numeric,
  total_servicios_cotizacion numeric,
  total_subtotal_cotizacion numeric,
  total_iva_cotizacion numeric,
  total_general_cotizacion numeric,
  informacion_general_moneda text,
  status_proyecto text,
  folio_orden_compra text,
  link_orden_compra text,
  fecha_inicio_proyecto text,
  informacion_general_instalacion_incluida boolean,
  notas_comerciales text,
  acciones_seguimiento jsonb,
  sustituye_folio_anterior text,
  prioridad_nivel text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Contactos
create table if not exists contacts (
  id text primary key,
  nombre text,
  puesto text,
  cliente text,
  planta text,
  email text,
  telefono text,
  "esEnlaceComercial" boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Bitácora de Auditoría
create table if not exists audit_logs (
  id text primary key,
  fecha text,
  accion text,
  operador text,
  perfil text,
  detalles text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Políticas Permisivas para Demostración del Sandbox
alter table crm_records enable row level security;
alter table contacts enable row level security;
alter table audit_logs enable row level security;

-- SI TU TABLA DE EXPEDIENTES SE LLAMA "DB CRM" (CON ESPACIO PRINCIPAL):
alter table if exists "DB CRM" enable row level security;

-- Limpiar políticas viejas si ya existen para evitar errores al re-ejecutar
drop policy if exists "Permiso lectura libre" on crm_records;
drop policy if exists "Permiso escritura libre" on crm_records;
drop policy if exists "Permiso edicion libre" on crm_records;
drop policy if exists "Permiso borrado libre" on crm_records;

create policy "Permiso lectura libre" on crm_records for select using (true);
create policy "Permiso escritura libre" on crm_records for insert with check (true);
create policy "Permiso edicion libre" on crm_records for update using (true);
create policy "Permiso borrado libre" on crm_records for delete using (true);

-- Políticas para la tabla con espacio "DB CRM":
drop policy if exists "Permiso lectura libre" on "DB CRM";
drop policy if exists "Permiso escritura libre" on "DB CRM";
drop policy if exists "Permiso edicion libre" on "DB CRM";
drop policy if exists "Permiso borrado libre" on "DB CRM";

create policy "Permiso lectura libre" on "DB CRM" for select using (true);
create policy "Permiso escritura libre" on "DB CRM" for insert with check (true);
create policy "Permiso edicion libre" on "DB CRM" for update using (true);
create policy "Permiso borrado libre" on "DB CRM" for delete using (true);

drop policy if exists "Permiso lectura libre" on contacts;
drop policy if exists "Permiso escritura libre" on contacts;
drop policy if exists "Permiso edicion libre" on contacts;
drop policy if exists "Permiso borrado libre" on contacts;

create policy "Permiso lectura libre" on contacts for select using (true);
create policy "Permiso escritura libre" on contacts for insert with check (true);
create policy "Permiso edicion libre" on contacts for update using (true);
create policy "Permiso borrado libre" on contacts for delete using (true);

drop policy if exists "Permiso lectura libre" on audit_logs;
drop policy if exists "Permiso escritura libre" on audit_logs;
drop policy if exists "Permiso edicion libre" on audit_logs;
drop policy if exists "Permiso borrado libre" on audit_logs;

create policy "Permiso lectura libre" on audit_logs for select using (true);
create policy "Permiso escritura libre" on audit_logs for insert with check (true);
create policy "Permiso edicion libre" on audit_logs for update using (true);
create policy "Permiso borrado libre" on audit_logs for delete using (true);
`;
