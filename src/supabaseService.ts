import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CRMRecord, Contact, AuditLog, UserAccount, UserRole, PurchaseOrder } from './types';
import { getMexicoCityDateTimeString, getMexicoCityDateString } from './dateUtils';
import { safeJsonParse } from './utils/coreUtils';

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
let resolvedUsuariosTableName: string | null = null;
let resolvedOCTableName: string | null = null;

let knownCRMTableColumns: string[] = [];
let knownContactsColumns: string[] = [];
let knownAuditLogsColumns: string[] = [];
let knownUsuariosColumns: string[] = [];
let knownOCTableColumns: string[] = [];

const CRM_TABLE_CANDIDATES = ['DB CRM'];
const CONTACTS_TABLE_CANDIDATES = ['contactos', 'Contactos', 'contacts', 'CONTACTS'];
const AUDIT_LOGS_TABLE_CANDIDATES = ['audit_logs', 'bitacora', 'AUDIT_LOGS', 'audit_log'];
const USUARIOS_TABLE_CANDIDATES = ['Usuarios', 'usuarios', 'users', 'USERS'];
const OC_TABLE_CANDIDATES = ['DB_OC', 'DB OC', 'db_oc', 'ordenes_compra', 'purchase_orders'];

export function getResolvedCRMTableName(): string {
  return resolvedCRMTableName || 'DB CRM';
}
export function getResolvedContactsTableName(): string {
  return resolvedContactsTableName || 'contactos';
}
export function getResolvedAuditLogsTableName(): string {
  return resolvedAuditLogsTableName || 'audit_logs';
}
export function getResolvedUsuariosTableName(): string {
  return resolvedUsuariosTableName || 'Usuarios';
}
export function getResolvedOCTableName(): string {
  return resolvedOCTableName || 'DB_OC';
}

/**
 * Probes the Supabase database to dynamically resolve actual table names
 */
async function checkTableExists(url: string, key: string, cand: string, client: any): Promise<{ exists: boolean; columns: string[] }> {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  const encoded = encodeURIComponent(cand);
  
  // 1. Intentar REST directo
  try {
    const selectQuery = (cand === 'Contactos' || cand === 'contactos') ? '*' : 'id';
    const res = await fetch(`${url}/rest/v1/${encoded}?select=${selectQuery}&limit=1`, { headers, method: 'GET' });
    if (res.ok) {
      const rows = await res.json();
      const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      return { exists: true, columns: cols };
    }
    
    // Si da error pero no es un 404 de "does not exist", significa que existe pero hay RLS o temas de permisos
    const text = await res.text();
    const noExiste = text.includes('42P01') || 
                      text.includes('does not exist') || 
                      text.includes('PGRST205') || 
                      text.includes('schema cache') || 
                      text.includes('Could not find') ||
                      res.status === 404;
    if (!noExiste) {
      return { exists: true, columns: [] };
    }
  } catch (e) {}

  // 2. Fallback con el SDK
  if (client) {
    try {
      const { data, error } = await client.from(cand).select('*').limit(1);
      if (!error) {
        const cols = data && data.length > 0 ? Object.keys(data[0]) : [];
        return { exists: true, columns: cols };
      } else {
        // Códigos de error de PostgREST: PGRST205 / 42P01 es relacion inexistente.
        // Si es otro código, la tabla sí existe pero está bloqueada o vacía.
        const msg = error.message?.toLowerCase() || '';
        const isMissing = error.code === 'PGRST205' || 
                          error.code === '42P01' || 
                          msg.includes('does not exist') || 
                          msg.includes('schema cache') || 
                          msg.includes('could not find');
        if (!isMissing) {
          return { exists: true, columns: [] };
        }
      }
    } catch (e) {}
  }

  return { exists: false, columns: [] };
}

export async function probeTables(url: string, key: string, forceReset = false) {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  if (forceReset || cachedUrl !== cleanUrl || cachedKey !== cleanKey) {
    resolvedCRMTableName = null;
    resolvedContactsTableName = null;
    resolvedAuditLogsTableName = null;
    resolvedUsuariosTableName = null;
    resolvedOCTableName = null;
    knownCRMTableColumns = [];
    knownContactsColumns = [];
    knownAuditLogsColumns = [];
    knownUsuariosColumns = [];
    knownOCTableColumns = [];
    cachedUrl = cleanUrl;
    cachedKey = cleanKey;
  }

  const client = getSupabaseClient(cleanUrl, cleanKey);

  // Probe CRM records table
  if (!resolvedCRMTableName) {
    for (const cand of CRM_TABLE_CANDIDATES) {
      const result = await checkTableExists(cleanUrl, cleanKey, cand, client);
      if (result.exists) {
        resolvedCRMTableName = cand;
        knownCRMTableColumns = result.columns;
        break;
      }
    }
    if (!resolvedCRMTableName) {
      resolvedCRMTableName = 'DB CRM';
    }
  }

  // Probe Contacts table
  if (!resolvedContactsTableName) {
    for (const cand of CONTACTS_TABLE_CANDIDATES) {
      const result = await checkTableExists(cleanUrl, cleanKey, cand, client);
      if (result.exists) {
        resolvedContactsTableName = cand;
        knownContactsColumns = result.columns;
        if (knownContactsColumns.length === 0) {
          if (cand === 'contactos') {
            knownContactsColumns = ['id', 'nombre', 'correo', 'telefono', 'puesto', 'empresa', 'tipo', 'cliente', 'organizacion', 'planta', 'ubicacion'];
          } else if (cand === 'Contactos') {
            knownContactsColumns = ['ID', 'Nombre', 'Correo', 'Teléfono', 'Puesto', 'Empresa', 'Tipo', 'Cliente', 'Organización', 'Planta', 'Ubicación'];
          } else {
            knownContactsColumns = ['id', 'nombre', 'puesto', 'cliente', 'planta', 'email', 'telefono', 'esEnlaceComercial', 'tipo', 'organizacion', 'prefijo_sufijo', 'pais', 'estado', 'ciudad', 'direccion', 'nombre_ubicacion', 'empresa'];
          }
        }
        break;
      }
    }
    if (!resolvedContactsTableName) {
      resolvedContactsTableName = 'contactos';
    }
  }

  // Probe Audit Logs table
  if (!resolvedAuditLogsTableName) {
    for (const cand of AUDIT_LOGS_TABLE_CANDIDATES) {
      const result = await checkTableExists(cleanUrl, cleanKey, cand, client);
      if (result.exists) {
        resolvedAuditLogsTableName = cand;
        knownAuditLogsColumns = result.columns;
        break;
      }
    }
    if (!resolvedAuditLogsTableName) {
      resolvedAuditLogsTableName = 'audit_logs';
    }
  }

  // Probe Usuarios table
  if (!resolvedUsuariosTableName) {
    for (const cand of USUARIOS_TABLE_CANDIDATES) {
      const result = await checkTableExists(cleanUrl, cleanKey, cand, client);
      if (result.exists) {
        resolvedUsuariosTableName = cand;
        knownUsuariosColumns = result.columns;
        break;
      }
    }
    if (!resolvedUsuariosTableName) {
      resolvedUsuariosTableName = 'Usuarios';
    }
  }

  // Probe OC table
  if (!resolvedOCTableName) {
    for (const cand of OC_TABLE_CANDIDATES) {
      const result = await checkTableExists(cleanUrl, cleanKey, cand, client);
      if (result.exists) {
        resolvedOCTableName = cand;
        knownOCTableColumns = result.columns;
        if (knownOCTableColumns.length === 0) {
          knownOCTableColumns = ['id', 'moneda'];
        }
        break;
      }
    }
    if (!resolvedOCTableName) {
      resolvedOCTableName = 'DB_OC';
      knownOCTableColumns = ['id', 'moneda'];
    }
  }
}

export async function teardownSupabaseClient(): Promise<void> {
  if (cachedClient) {
    try {
      console.log("🧹 Desconectando de forma segura canales y listeners del cliente Supabase previo...");
      // 1. Desvincular de forma masiva los hilos de WebSockets activos en el pool
      await cachedClient.removeAllChannels();
      // 2. Limpiar listeners globales de estado de autenticación
      const { data: { subscription } } = cachedClient.auth.onAuthStateChange(() => {});
      subscription?.unsubscribe();
    } catch (e) {
      console.warn("Advertencia controlada durante el desmontaje de Supabase:", e);
    }
    cachedClient = null;
  }
}

export function getSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  // Si la configuración coincide exactamente, reutilizamos la instancia en caché
  if (cachedClient && cachedUrl === cleanUrl && cachedKey === cleanKey) {
    return cachedClient;
  }

  // 🛡️ CORRECCIÓN MEMORY LEAK: Si las credenciales cambiaron (Sandbox/Prod), forzamos la purga masiva
  if (cachedClient) {
    console.warn("⚠️ Detectado cambio de credenciales en caliente. Forzando purga de conexiones viejas.");
    cachedClient.removeAllChannels();
    cachedClient = null;
  }

  try {
    cachedUrl = cleanUrl;
    cachedKey = cleanKey;
    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
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
    const contactsTable = getResolvedContactsTableName();
    const contactsTableEncoded = encodeURIComponent(contactsTable);
    const auditTableEncoded = encodeURIComponent(getResolvedAuditLogsTableName());
    
    const contactsSelect = (contactsTable === 'Contactos' || contactsTable === 'contactos') ? '*' : 'id';

    const [resRec, resCon, resAud] = await Promise.all([
      fetch(`${cleanUrl}/rest/v1/${crmTableEncoded}?select=id&limit=1`, { headers, method: 'GET' }),
      fetch(`${cleanUrl}/rest/v1/${contactsTableEncoded}?select=${contactsSelect}&limit=1`, { headers, method: 'GET' }),
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
      } else if (!conErr) {
        const contactsTable = getResolvedContactsTableName();
        if (contactsTable === 'contactos') {
          knownContactsColumns = ['nombre', 'puesto', 'cliente', 'planta', 'correo', 'telefono'];
        } else if (contactsTable === 'Contactos') {
          knownContactsColumns = ['Nombre', 'Puesto', 'Cliente', 'Planta', 'Correo', 'Teléfono'];
        }
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

function cleanStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  const lower = s.toLowerCase();
  if (lower === 'no proporcionado' || lower === 'no_proporcionado' || lower === 'n/a' || lower === 'na' || lower === 'null' || lower === 'undefined') {
    return null;
  }
  return s;
}

export function mapRawCRMRecord(r: any): CRMRecord {
  const rawHw = getFlexibleValue(r, ['total_hardware_cotizacion', 'hardware', 'Hardware']);
  const rawServ = getFlexibleValue(r, ['total_servicios_cotizacion', 'servicios', 'servicio', 'Servicios']);

  const hardware = (rawHw === null || rawHw === undefined || String(rawHw).trim() === '') ? null : Number(rawHw);
  const servicios = (rawServ === null || rawServ === undefined || String(rawServ).trim() === '') ? null : Number(rawServ);
  
  const rawSub = getFlexibleValue(r, ['total_subtotal_cotizacion', 'subtotal', 'Subtotal']);
  const dbSubtotal = (rawSub === null || rawSub === undefined || String(rawSub).trim() === '') ? null : Number(rawSub);

  const rawIva = getFlexibleValue(r, ['total_iva_cotizacion', 'iva', 'IVA']);
  const dbIva = (rawIva === null || rawIva === undefined || String(rawIva).trim() === '') ? null : Number(rawIva);

  const rawGen = getFlexibleValue(r, ['total_general_cotizacion', 'total', 'Total', 'general_cotizacion']);
  const dbGeneral = (rawGen === null || rawGen === undefined || String(rawGen).trim() === '') ? null : Number(rawGen);

  const subtotal = dbSubtotal !== null ? dbSubtotal : ((hardware !== null ? hardware : 0) + (servicios !== null ? servicios : 0));
  const iva = dbIva !== null ? dbIva : 0;
  const general = dbGeneral !== null ? dbGeneral : subtotal;

  const rawAcciones = getFlexibleValue(r, ['acciones_seguimiento', 'acciones', 'acciones_seguimiento'], []);
  let acciones_parsed: any[] = [];
  if (Array.isArray(rawAcciones)) {
    acciones_parsed = rawAcciones;
  } else if (typeof rawAcciones === 'string' && rawAcciones.trim() !== '') {
    const trimmed = rawAcciones.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = safeJsonParse<any[] | null>(trimmed, null, 'acciones_seguimiento');
      if (parsed) {
        acciones_parsed = parsed;
      } else {
        // Fallback to single legacy entry if JSON structure parse fails
        acciones_parsed = [{
          id: `f_legacy_${Math.random().toString(36).substring(2, 9)}`,
          fecha: getMexicoCityDateString(),
          tipo: 'Llamada Telefónica',
          creador: 'Historial',
          notas: trimmed
        }];
      }
    } else {
      // It is a plain string. Gracefully treat as a legacy mockup or single line note
      acciones_parsed = [{
        id: `f_legacy_${Math.random().toString(36).substring(2, 9)}`,
        fecha: getMexicoCityDateString(),
        tipo: 'Llamada Telefónica',
        creador: 'Historial',
        notas: trimmed
      }];
    }
  }

  const rawMoneda = String(getFlexibleValue(r, ['informacion_general_moneda', 'moneda', 'Moneda'], 'USD')).toUpperCase();
  const moneda = (rawMoneda === 'MXN' ? 'MXN' : 'USD') as 'USD' | 'MXN';

  const rawEstadoVal = getFlexibleValue(r, ['estado_proyecto', 'estado', 'Estado', 'estado_proyecto'], null);
  let finalEstado: 'Propuesta' | 'Negociación' | 'Cerrado Ganado' | null = null;
  if (rawEstadoVal !== null && String(rawEstadoVal).trim() !== '') {
    const rawEstado = String(rawEstadoVal).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rawEstado.includes('ganado') || rawEstado.includes('cerrado')) {
      finalEstado = 'Cerrado Ganado';
    } else if (rawEstado.includes('negociacion') || rawEstado.includes('negotiation') || rawEstado.includes('proceso')) {
      finalEstado = 'Negociación';
    } else if (rawEstado.includes('propuesta') || rawEstado.includes('proposal')) {
      finalEstado = 'Propuesta';
    }
  }

  const rawStatusVal = getFlexibleValue(r, ['status_proyecto', 'prioridad_nivel', 'prioridad', 'status_proyecto', 'status', 'Status'], null);
  let finalStatusNivel: 'Win' | 'Hot' | 'Warm' | 'Cool' | null = null;
  if (rawStatusVal !== null && String(rawStatusVal).trim() !== '') {
    const rawStatus = String(rawStatusVal).trim().toLowerCase();
    if (rawStatus.includes('win')) finalStatusNivel = 'Win';
    else if (rawStatus.includes('hot')) finalStatusNivel = 'Hot';
    else if (rawStatus.includes('cool')) finalStatusNivel = 'Cool';
    else if (rawStatus.includes('warm')) finalStatusNivel = 'Warm';
  }

  const detectedFolioOc = String(getFlexibleValue(r, ['folio_orden_compra', 'folio_oc', 'folio oc', 'Folio OC', 'folio_orden_compra'], '')).trim();

  const rawInstalacion = getFlexibleValue(r, ['informacion_general_instalacion_incluida', 'instalacion_incluida', 'instalacion incluida', 'instalacion'], false);
  const instalacion = rawInstalacion === true || rawInstalacion === 'true' || rawInstalacion === 't' || rawInstalacion === 1 || rawInstalacion === '1';

  return {
    id: toValidUUID(String(getFlexibleValue(r, ['id', 'ID', '_id', 'informacion_general_folio', 'folio', 'Folio']) || '')),
    informacion_general_folio: cleanStr(getFlexibleValue(r, ['informacion_general_folio', 'folio', 'Folio'])) || null,
    fecha_registro: getFlexibleValue(r, ['informacion_general_fecha', 'fecha_registro', 'fecha registro', 'fecha', 'registro', 'Fecha Registro']) || null,
    informacion_general_cliente: cleanStr(getFlexibleValue(r, ['informacion_general_cliente', 'cliente', 'Cliente'])) || null,
    informacion_general_planta: cleanStr(getFlexibleValue(r, ['informacion_general_planta', 'planta', 'Planta'])) || null,
    cliente_pais: cleanStr(getFlexibleValue(r, ['cliente_pais', 'pais', 'Pais', 'country'])) || null,
    cliente_ubicacion: cleanStr(getFlexibleValue(r, ['cliente_ubicacion', 'ubicacion', 'Ubicacion', 'ciudad', 'location'])) || null,
    informacion_general_proyecto: cleanStr(getFlexibleValue(r, ['informacion_general_proyecto', 'proyecto', 'Proyecto'])) || null,
    informacion_general_link_cotizacion: cleanStr(getFlexibleValue(r, ['informacion_general_link_cotizacion', 'link_cotizacion', 'link cotizacion', 'Link Cotizacion', 'cotizacion'])) || null,
    total_hardware_cotizacion: hardware,
    total_servicios_cotizacion: servicios,
    total_subtotal_cotizacion: subtotal,
    total_iva_cotizacion: iva,
    total_general_cotizacion: general,
    informacion_general_moneda: moneda,
    estado_proyecto: finalEstado,
    status_proyecto: finalStatusNivel,
    folio_orden_compra: detectedFolioOc || null,
    link_orden_compra: cleanStr(getFlexibleValue(r, ['link_orden_compra', 'link_oc', 'link oc', 'Link OC', 'link_orden_compra'])) || null,
    fecha_inicio_proyecto: getFlexibleValue(r, ['fecha_inicio_proyecto', 'fecha_inicio', 'fecha inicio', 'Fecha Inicio']) || null,
    informacion_general_instalacion_incluida: instalacion,
    notas_comerciales: cleanStr(getFlexibleValue(r, ['notas_comerciales', 'notas', 'Notas', 'notas_comerciales'])) || null,
    acciones_seguimiento: acciones_parsed,
    sustituye_folio_anterior: cleanStr(getFlexibleValue(r, ['sustituye_folio_anterior', 'sustituye', 'sustituye_folio_anterior'])) || null,
    prioridad_nivel: finalStatusNivel,

    // Campos independientes mapeados de la base de datos
    etapa: cleanStr(getFlexibleValue(r, ['etapa', 'Etapa', 'kanban_stage', 'stage'])) || null,
    nivel_termo: getFlexibleValue(r, ['nivel_termo', 'nivel_termo', 'nivel', 'nivel_termo_proyecto']) || finalStatusNivel,
    prioridad: (() => {
      const pVal = getFlexibleValue(r, ['prioridad', 'Prioridad', 'order', 'orden', 'posicion']);
      return (pVal !== null && pVal !== undefined && String(pVal).trim() !== '') ? Number(pVal) : 0;
    })(),
    estado: getFlexibleValue(r, ['estado', 'Estado', 'estado_proyecto', 'estado_proyecto']) || finalEstado,

    // Nuevos campos para persistencia en Supabase
    fecha_cambio_etapa: getFlexibleValue(r, ['fecha_cambio_etapa', 'fecha_cambio_etapa', 'dateEnteredStage', 'date_entered_stage']) || null,
    stagnation_days_limit: (() => {
      const v = getFlexibleValue(r, ['stagnation_days_limit', 'stagnation_days_limit', 'stagnation_limit']);
      return (v !== null && v !== undefined && String(v).trim() !== '') ? Number(v) : 5;
    })(),
    checklist_tasks: getFlexibleValue(r, ['checklist_tasks', 'checklist_tasks', 'checklist', 'subtasks']) || null,
    __tareas: (() => {
      const t = getFlexibleValue(r, ['__tareas', 'tareas']);
      if (!t) return [];
      if (Array.isArray(t)) return t;
      const parsed = safeJsonParse<any[]>(t, [], '__tareas');
      return Array.isArray(parsed) ? parsed : [];
    })(),
    contacto_asignado_id: cleanStr(getFlexibleValue(r, ['contacto_asignado_id', 'contacto_asignado_id', 'responsable_id'])) || null,
    responsable: cleanStr(getFlexibleValue(r, ['responsable', 'responsable', 'propietario', 'owner'])) || null,
    tags: getFlexibleValue(r, ['tags', 'tags', 'etiquetas']) || null,

    // Campos de contacto asignado
    contacto_nombre: cleanStr(getFlexibleValue(r, ['contacto_nombre', 'contacto_nombre'])) || null,
    contacto_puesto: cleanStr(getFlexibleValue(r, ['contacto_puesto', 'contacto_puesto'])) || null,
    contacto_email: cleanStr(getFlexibleValue(r, ['contacto_email', 'contacto_email', 'contacto_correo'])) || null,
    contacto_telefono: cleanStr(getFlexibleValue(r, ['contacto_telefono', 'contacto_telefono'])) || null
  };
}

export function mapRawContact(c: any): Contact {
  const esEnlaceComercialVal = getFlexibleValue(c, ['esEnlaceComercial', 'esenlacecomercial', 'es_enlace_comercial'], false);
  const isEnlace = esEnlaceComercialVal === true || esEnlaceComercialVal === 'true' || esEnlaceComercialVal === 't' || esEnlaceComercialVal === 1 || esEnlaceComercialVal === '1';

  return {
    id: getFlexibleValue(c, ['id', 'ID', '_id', 'Correo', 'correo', 'email', 'Email']) || `con_${Math.random().toString(36).substr(2, 9)}`,
    nombre: getFlexibleValue(c, ['nombre', 'Nombre']) || '',
    puesto: getFlexibleValue(c, ['puesto', 'Puesto']) || '',
    cliente: getFlexibleValue(c, ['cliente', 'Cliente']) || '',
    planta: getFlexibleValue(c, ['planta', 'Planta', 'Nombre de la Planta']) || '',
    email: getFlexibleValue(c, ['email', 'Email', 'Correo', 'correo']) || '',
    telefono: getFlexibleValue(c, ['telefono', 'Telefono', 'Teléfono', 'teléfono']) || '',
    esEnlaceComercial: isEnlace,
    tipo: getFlexibleValue(c, ['tipo', 'Tipo']) || '',
    organizacion: getFlexibleValue(c, ['organizacion', 'Organizacion', 'Organización']) || '',
    prefijoSufijo: getFlexibleValue(c, ['prefijoSufijo', 'prefijo_sufijo', 'Prefijo/Sufijo']) || '',
    pais: getFlexibleValue(c, ['pais', 'Pais', 'País']) || '',
    estado: getFlexibleValue(c, ['estado', 'Estado']) || '',
    ciudad: getFlexibleValue(c, ['ciudad', 'Ciudad']) || '',
    direccion: getFlexibleValue(c, ['direccion', 'Direccion', 'Dirección']) || '',
    nombreUbicacion: getFlexibleValue(c, ['nombreUbicacion', 'nombre_ubicacion', 'Nombre de la ubicación para su identificación', 'Ubicación', 'ubicacion']) || '',
    empresa: getFlexibleValue(c, ['empresa', 'Empresa']) || ''
  };
}

export function mapRawAuditLog(l: any): AuditLog {
  return {
    id: getFlexibleValue(l, ['id', 'ID', '_id']) || `aud_${Math.random().toString(36).substr(2, 9)}`,
    fecha: getFlexibleValue(l, ['fecha', 'Fecha']) || getMexicoCityDateTimeString(),
    accion: getFlexibleValue(l, ['accion', 'Accion']) || 'MODIFICACIÓN',
    operador: getFlexibleValue(l, ['operador', 'Operador']) || 'sistema',
    perfil: getFlexibleValue(l, ['perfil', 'Perfil']) || 'Solo Lectura',
    detalles: getFlexibleValue(l, ['detalles', 'Detalles']) || ''
  };
}

export function mapRawUserAccount(u: any): UserAccount {
  const rawRol = String(getFlexibleValue(u, ['rol', 'role', 'Rol', 'Role', 'perfil', 'Perfil'], 'Solo Lectura')).trim();
  let finalRole: UserRole = 'Solo Lectura';
  if (rawRol.toLowerCase() === 'admin' || rawRol.toLowerCase() === 'administrador') {
    finalRole = 'Admin';
  } else if (rawRol.toLowerCase() === 'vendedor' || rawRol.toLowerCase() === 'sales') {
    finalRole = 'Vendedor';
  } else if (rawRol.toLowerCase() === 'solo lectura' || rawRol.toLowerCase() === 'auditor' || rawRol.toLowerCase() === 'readonly' || rawRol.toLowerCase() === 'solo_lectura') {
    finalRole = 'Solo Lectura';
  }

  const rawEstado = String(getFlexibleValue(u, ['estado', 'status', 'Estado', 'Status'], 'pending')).trim().toLowerCase();
  let finalEstado: 'active' | 'pending' | 'rejected' = 'pending';
  if (rawEstado === 'active' || rawEstado === 'activo' || rawEstado === 'autorizado' || rawEstado === 'approved') {
    finalEstado = 'active';
  } else if (rawEstado === 'rejected' || rawEstado === 'rechazado' || rawEstado === 'denied') {
    finalEstado = 'rejected';
  }

  return {
    id: getFlexibleValue(u, ['id', 'ID', '_id']) || toValidUUID(getFlexibleValue(u, ['email', 'Email']) || ''),
    email: String(getFlexibleValue(u, ['email', 'Email']) || '').trim().toLowerCase(),
    nombre: getFlexibleValue(u, ['nombre', 'name', 'Nombre', 'Name']) || '',
    rol: finalRole,
    estado: finalEstado,
    created_at: getFlexibleValue(u, ['created_at', 'createdat', 'fecha_registro', 'fecha'], getMexicoCityDateTimeString())
  };
}

export function mapRawPurchaseOrder(oc: any): PurchaseOrder {
  const monedaVal = String(getFlexibleValue(oc, ['moneda', 'Moneda', 'currency'], 'MXN')).trim().toUpperCase();
  const finalMoneda: 'USD' | 'MXN' = (monedaVal === 'USD' || monedaVal === 'usd') ? 'USD' : 'MXN';

  const instalacionVal = getFlexibleValue(oc, ['instalacionIncluida', 'instalacion_incluida', 'instalacion', 'Instalación', 'Instalación Incluida', 'instalacionIncluida'], true);
  const isInstalacion = instalacionVal === true || instalacionVal === 'true' || instalacionVal === 't' || instalacionVal === 1 || instalacionVal === '1';

  return {
    id: String(getFlexibleValue(oc, ['id', 'ID', '_id']) || `po_${Math.random().toString(36).substr(2, 9)}`),
    folioOC: String(getFlexibleValue(oc, ['folioOC', 'folio_oc', 'folio_orden_compra', 'Folio OC', 'Folio_OC'], '')),
    linkOC: String(getFlexibleValue(oc, ['linkOC', 'link_oc', 'link_orden_compra', 'Link OC', 'Link_OC', 'pdf', 'enlace', 'archivo'], '')),
    fechaInicio: String(getFlexibleValue(oc, ['fechaInicio', 'fecha_inicio', 'fecha_inicio_proyecto', 'Fecha Inicio', 'Fecha_Inicio', 'fecha'], '')),
    instalacionIncluida: isInstalacion,
    monto: Number(getFlexibleValue(oc, ['monto', 'monto_total', 'total', 'Monto', 'Total', 'importe'], 0)) || 0,
    moneda: finalMoneda,
    cliente: String(getFlexibleValue(oc, ['cliente', 'Cliente', 'empresa', 'Empresa'], '')),
    proyecto: String(getFlexibleValue(oc, ['proyecto', 'Proyecto', 'obra', 'Obra'], '')),
    folioRefCRM: String(getFlexibleValue(oc, ['folioRefCRM', 'folioRef', 'folio_crm', 'folioRefCRM', 'folio_ref', 'folio'], ''))
  };
}

/**
 * Load all user accounts from the Usuarios table in Supabase
 */
export async function loadUsersFromSupabase(url: string, key: string): Promise<{
  success: boolean;
  users: UserAccount[];
  message: string;
}> {
  const client = getSupabaseClient(url, key);
  if (!client) {
    return { success: false, users: [], message: 'No se pudo conectar a Supabase.' };
  }

  try {
    const tableName = getResolvedUsuariosTableName();
    const { data, error } = await client
      .from(tableName)
      .select('*');

    if (error) {
      console.error('Error al cargar usuarios de Supabase:', error);
      return { success: false, users: [], message: error.message };
    }

    const mapped = (data || []).map(mapRawUserAccount);
    return { success: true, users: mapped, message: 'Usuarios cargados exitosamente.' };
  } catch (err: any) {
    console.error('Error de red al cargar usuarios de Supabase:', err);
    return { success: false, users: [], message: err.message || String(err) };
  }
}

/**
 * Upserts a UserAccount to Supabase
 */
export async function upsertUserToSupabase(
  url: string,
  key: string,
  user: UserAccount
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const tableName = getResolvedUsuariosTableName();
    
    // Prepare payload
    const payload: any = {
      id: user.id || toValidUUID(user.email),
      email: user.email.trim().toLowerCase(),
      nombre: user.nombre,
      rol: user.rol,
      estado: user.estado,
      created_at: user.created_at || getMexicoCityDateTimeString()
    };

    const { error } = await client
      .from(tableName)
      .upsert(payload, { onConflict: 'email' });

    if (error) {
      console.warn('Error on upsert user, trying insert...', error);
      const { error: insError } = await client
        .from(tableName)
        .insert(payload);
      if (insError) {
        console.error('Error inserting user to Supabase:', insError);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Error de red al subir usuario a Supabase:', err);
    return false;
  }
}

/**
 * Initializes the default 3 users if they don't already exist in the database
 */
export async function initializeDefaultUsers(url: string, key: string): Promise<{ success: boolean; message: string }> {
  const defaultUsers: UserAccount[] = [
    {
      id: toValidUUID('geovanni@verse-technology.com'),
      email: 'geovanni@verse-technology.com',
      nombre: 'Geovanni Verse',
      rol: 'Admin',
      estado: 'active',
      created_at: getMexicoCityDateTimeString()
    },
    {
      id: toValidUUID('marisol@verse-technology.com'),
      email: 'marisol@verse-technology.com',
      nombre: 'Marisol Verse',
      rol: 'Solo Lectura',
      estado: 'active',
      created_at: getMexicoCityDateTimeString()
    },
    {
      id: toValidUUID('ruth.triana@verse-technology.com'),
      email: 'ruth.triana@verse-technology.com',
      nombre: 'Ruth Triana',
      rol: 'Vendedor',
      estado: 'active',
      created_at: getMexicoCityDateTimeString()
    }
  ];

  const client = getSupabaseClient(url, key);
  if (!client) {
    return { success: false, message: 'No se pudo inicializar: cliente no configurado.' };
  }

  const tableName = getResolvedUsuariosTableName();
  let addedCount = 0;
  let skippedCount = 0;

  for (const user of defaultUsers) {
    try {
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .eq('email', user.email);
      
      if (!error && data && data.length > 0) {
        skippedCount++;
        continue;
      }

      const payload = {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        estado: user.estado,
        created_at: user.created_at
      };

      const { error: insError } = await client
        .from(tableName)
        .upsert(payload);

      if (insError) {
        console.error('Error inserting default user:', insError);
      } else {
        addedCount++;
      }
    } catch (e) {
      console.error('Exception inserting default user:', e);
    }
  }

  return { 
    success: true, 
    message: `Proceso completado. Usuarios agregados: ${addedCount}, ya existentes: ${skippedCount}.` 
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
  purchaseOrders: PurchaseOrder[];
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
  const ocTable = getResolvedOCTableName();

  let recData: any[] = [];
  let conData: any[] = [];
  let audData: any[] = [];
  let ocData: any[] = [];
  let fetchedViaRest = false;
  let restErrorMsg = '';

  const client = getSupabaseClient(url, key);
  let bearerToken = cleanKey;
  if (client) {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (session && session.access_token) {
        bearerToken = session.access_token;
        console.log("Using active Supabase Auth user session JWT token for direct REST requests.");
      }
    } catch (e) {
      console.warn("Failed to check active Supabase Auth session, using anon key fallback:", e);
    }
  }

  // 1. INTENTAR PRIMERO VÍA REST HTTP DIRECTA (Inmune a bloqueadores de cookies/GoTrue de iframes)
  let crmOk = false;
  let conOk = false;
  let audOk = false;
  let ocOk = false;

  try {
    const headers = {
      'apikey': cleanKey,
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    };

    const crmTableEncoded = encodeURIComponent(crmTable);
    const contactsTableEncoded = encodeURIComponent(contactsTable);
    const auditLogsTableEncoded = encodeURIComponent(auditLogsTable);
    const ocTableEncoded = encodeURIComponent(ocTable);

    // Intentar CRM
    try {
      const resRec = await fetch(`${cleanUrl}/rest/v1/${crmTableEncoded}?select=*&limit=150`, { headers, method: 'GET' });
      if (resRec.ok) {
        recData = await resRec.json();
        crmOk = true;
        if (recData.length > 0) knownCRMTableColumns = Object.keys(recData[0]);
      } else {
        console.warn(`REST CRM Table ${crmTable} status: ${resRec.status}`);
      }
    } catch (e) {
      console.warn(`REST CRM fetch failed:`, e);
    }

    // Intentar Contactos
    try {
      const resCon = await fetch(`${cleanUrl}/rest/v1/${contactsTableEncoded}?select=*`, { headers, method: 'GET' });
      if (resCon.ok) {
        conData = await resCon.json();
        conOk = true;
        if (conData.length > 0) {
          knownContactsColumns = Object.keys(conData[0]);
        } else {
          if (contactsTable === 'contactos') {
            knownContactsColumns = ['id', 'nombre', 'correo', 'telefono', 'puesto', 'empresa', 'tipo', 'cliente', 'organizacion', 'planta', 'ubicacion'];
          } else if (contactsTable === 'Contactos') {
            knownContactsColumns = ['ID', 'Nombre', 'Correo', 'Teléfono', 'Puesto', 'Empresa', 'Tipo', 'Cliente', 'Organización', 'Planta', 'Ubicación'];
          }
        }
      } else {
        console.warn(`REST Contacts Table ${contactsTable} status: ${resCon.status}`);
      }
    } catch (e) {
      console.warn(`REST Contacts fetch failed:`, e);
    }

    // Intentar Bitácora
    try {
      const resAud = await fetch(`${cleanUrl}/rest/v1/${auditLogsTableEncoded}?select=*`, { headers, method: 'GET' });
      if (resAud.ok) {
        audData = await resAud.json();
        audOk = true;
        if (audData.length > 0) knownAuditLogsColumns = Object.keys(audData[0]);
      } else {
        console.warn(`REST Audit Table ${auditLogsTable} status: ${resAud.status}`);
      }
    } catch (e) {
      console.warn(`REST Audit fetch failed:`, e);
    }

    // Intentar OC
    try {
      const resOc = await fetch(`${cleanUrl}/rest/v1/${ocTableEncoded}?select=*`, { headers, method: 'GET' });
      if (resOc.ok) {
        ocData = await resOc.json();
        ocOk = true;
        if (ocData.length > 0) knownOCTableColumns = Object.keys(ocData[0]);
      } else {
        console.warn(`REST OC Table ${ocTable} status: ${resOc.status}`);
      }
    } catch (e) {
      console.warn(`REST OC fetch failed:`, e);
    }

    if (crmOk || conOk || audOk || ocOk) {
      fetchedViaRest = true;
    } else {
      restErrorMsg = "Ninguna tabla pudo ser recuperada vía REST API directa.";
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
        purchaseOrders: [],
        message: `Cliente Supabase no inicializado. Detalle del fallo REST: ${restErrorMsg}` 
      };
    }

    let sdkSuccess = false;
    let sdkErrorDetails = '';

    // Carga robusta con el SDK por tabla
    try {
      const { data: sdkRec, error: recErr } = await client.from(crmTable).select('*').limit(150);
      if (recErr) {
        sdkErrorDetails += `CRM: ${recErr.message || JSON.stringify(recErr)}. `;
      } else if (sdkRec) {
        recData = sdkRec;
        sdkSuccess = true;
        if (recData.length > 0) knownCRMTableColumns = Object.keys(recData[0]);
      }
    } catch (e: any) {
      sdkErrorDetails += `CRM Ex: ${e.message || e}. `;
    }

    try {
      const { data: sdkCon, error: conErr } = await client.from(contactsTable).select('*');
      if (conErr) {
        sdkErrorDetails += `Contacts: ${conErr.message || JSON.stringify(conErr)}. `;
      } else if (sdkCon) {
        conData = sdkCon;
        sdkSuccess = true;
        if (conData.length > 0) {
          knownContactsColumns = Object.keys(conData[0]);
        } else {
          if (contactsTable === 'contactos') {
            knownContactsColumns = ['id', 'nombre', 'correo', 'telefono', 'puesto', 'empresa', 'tipo', 'cliente', 'organizacion', 'planta', 'ubicacion'];
          } else if (contactsTable === 'Contactos') {
            knownContactsColumns = ['ID', 'Nombre', 'Correo', 'Teléfono', 'Puesto', 'Empresa', 'Tipo', 'Cliente', 'Organización', 'Planta', 'Ubicación'];
          }
        }
      }
    } catch (e: any) {
      sdkErrorDetails += `Contacts Ex: ${e.message || e}. `;
    }

    try {
      const { data: sdkAud, error: audErr } = await client.from(auditLogsTable).select('*');
      if (audErr) {
        sdkErrorDetails += `Audit: ${audErr.message || JSON.stringify(audErr)}. `;
      } else if (sdkAud) {
        audData = sdkAud;
        sdkSuccess = true;
        if (audData.length > 0) knownAuditLogsColumns = Object.keys(audData[0]);
      }
    } catch (e: any) {
      sdkErrorDetails += `Audit Ex: ${e.message || e}. `;
    }

    try {
      const { data: sdkOc, error: ocErr } = await client.from(ocTable).select('*');
      if (ocErr) {
        sdkErrorDetails += `OC: ${ocErr.message || JSON.stringify(ocErr)}. `;
      } else if (sdkOc) {
        ocData = sdkOc;
        sdkSuccess = true;
        if (ocData.length > 0) knownOCTableColumns = Object.keys(ocData[0]);
      }
    } catch (e: any) {
      sdkErrorDetails += `OC Ex: ${e.message || e}. `;
    }

    if (!sdkSuccess) {
      return {
        success: false,
        records: [],
        contacts: [],
        auditLogs: [],
        purchaseOrders: [],
        message: `Error al importar datos en ambos canales (REST & SDK). REST: ${restErrorMsg} | SDK: ${sdkErrorDetails}`
      };
    }
  }

  // Si a pesar de todo las columnas de contactos siguen vacías, inicializar por nombre de tabla
  if (knownContactsColumns.length === 0) {
    if (contactsTable === 'contactos') {
      knownContactsColumns = ['id', 'nombre', 'correo', 'telefono', 'puesto', 'empresa', 'tipo', 'cliente', 'organizacion', 'planta', 'ubicacion'];
    } else if (contactsTable === 'Contactos') {
      knownContactsColumns = ['ID', 'Nombre', 'Correo', 'Teléfono', 'Puesto', 'Empresa', 'Tipo', 'Cliente', 'Organización', 'Planta', 'Ubicación'];
    }
  }

  // 3. MAPEO Y NORMALIZACIÓN DE DATOS (Mismo algoritmo de cálculo y des-serialización de JSON)
  try {
    const records: CRMRecord[] = recData.map(mapRawCRMRecord);
    records.sort((a, b) => (b.fecha_registro || '').localeCompare(a.fecha_registro || '') || (b.id || '').localeCompare(a.id || ''));

    let contacts: Contact[] = conData.map(mapRawContact);

    // Auto-recuperación (self-healing): Si la tabla de contactos está vacía en Supabase pero hay expedientes,
    // extraemos dinámicamente los contactos de los expedientes del CRM para no mostrar una pantalla vacía.
    if (contacts.length === 0 && recData.length > 0) {
      const seenNames = new Set<string>();
      const extractedContacts: Contact[] = [];
      for (const r of recData) {
        const nombre = getFlexibleValue(r, ['contacto_nombre', 'contactoNombre', 'Contacto Nombre', 'Contacto_Nombre']) || '';
        const cleanNombre = String(nombre).trim();
        if (cleanNombre && cleanNombre !== 'NO PROPORCIONADO' && cleanNombre !== 'N/A' && !seenNames.has(cleanNombre.toLowerCase())) {
          seenNames.add(cleanNombre.toLowerCase());
          
          const puesto = getFlexibleValue(r, ['contacto_puesto', 'contactoPuesto', 'Contacto Puesto', 'Contacto_Puesto']) || '';
          const email = getFlexibleValue(r, ['contacto_email', 'contactoEmail', 'Contacto Email', 'Contacto_Email', 'contacto_correo', 'contacto_correo_electronico']) || '';
          const telefono = getFlexibleValue(r, ['contacto_telefono', 'contactoTelefono', 'Contacto Telefono', 'Contacto_Telefono']) || '';
          const cliente = getFlexibleValue(r, ['informacion_general_cliente', 'cliente', 'Cliente']) || '';
          const planta = getFlexibleValue(r, ['informacion_general_planta', 'planta', 'Planta']) || '';
          const ubicacion = getFlexibleValue(r, ['cliente_ubicacion', 'ubicacion', 'Ubicacion']) || '';
          
          const cleanEmail = String(email).trim() === 'NO PROPORCIONADO' ? '' : String(email).trim();
          const cleanTelefono = String(telefono).trim() === 'NO PROPORCIONADO' ? '' : String(telefono).trim();

          extractedContacts.push({
            id: toValidUUID(cleanNombre + "_" + (cleanEmail || "no_email")),
            nombre: cleanNombre,
            puesto: String(puesto).trim() === 'NO PROPORCIONADO' ? '' : String(puesto).trim(),
            cliente: String(cliente).trim(),
            planta: String(planta).trim(),
            email: cleanEmail,
            telefono: cleanTelefono,
            esEnlaceComercial: false,
            tipo: 'Cliente',
            organizacion: 'Mantenimiento',
            empresa: String(cliente).trim(),
            nombreUbicacion: String(ubicacion).trim()
          });
        }
      }
      if (extractedContacts.length > 0) {
        contacts = extractedContacts;
        console.log(`Auto-extracted ${contacts.length} unique contacts from ${recData.length} CRM records.`);
      }
    }

    contacts.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    const auditLogs: AuditLog[] = audData.map(mapRawAuditLog);
    auditLogs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    // Dynamic mapping & self-healing of Purchase Orders
    let purchaseOrders: PurchaseOrder[] = ocData.map(mapRawPurchaseOrder);

    const seenPoFolios = new Set<string>();
    purchaseOrders.forEach(po => {
      if (po.folioOC) seenPoFolios.add(po.folioOC.toLowerCase());
      if (po.folioRefCRM) seenPoFolios.add(po.folioRefCRM.toLowerCase());
    });

    const wonRecords = records.filter(r => 
      r.estado_proyecto === 'Cerrado Ganado'
    );

    for (const r of wonRecords) {
      const folioOC = r.folio_orden_compra || `OC-PENDIENTE-${r.informacion_general_folio}`;
      const hasDirectPo = seenPoFolios.has(folioOC.toLowerCase()) || seenPoFolios.has(r.informacion_general_folio.toLowerCase());

      if (!hasDirectPo) {
        purchaseOrders.push({
          id: `po_ext_${r.informacion_general_folio}`,
          folioOC: r.folio_orden_compra || `PENDIENTE-${r.informacion_general_folio}`,
          linkOC: r.link_orden_compra || '',
          fechaInicio: r.fecha_inicio_proyecto || r.fecha_registro || '',
          instalacionIncluida: r.informacion_general_instalacion_incluida ?? true,
          monto: r.total_general_cotizacion || 0,
          moneda: (r.informacion_general_moneda === 'USD' ? 'USD' : 'MXN'),
          cliente: r.informacion_general_cliente || '',
          proyecto: r.informacion_general_proyecto || '',
          folioRefCRM: r.informacion_general_folio
        });
      } else {
        const matchingPoIndex = purchaseOrders.findIndex(p => 
          (p.folioOC && p.folioOC.toLowerCase() === folioOC.toLowerCase()) || 
          (p.folioRefCRM && p.folioRefCRM.toLowerCase() === r.informacion_general_folio.toLowerCase())
        );
        if (matchingPoIndex !== -1) {
          const matchedPo = purchaseOrders[matchingPoIndex];
          purchaseOrders[matchingPoIndex] = {
            ...matchedPo,
            folioOC: matchedPo.folioOC || r.folio_orden_compra || `PENDIENTE-${r.informacion_general_folio}`,
            linkOC: matchedPo.linkOC || r.link_orden_compra || '',
            fechaInicio: matchedPo.fechaInicio || r.fecha_inicio_proyecto || r.fecha_registro || '',
            instalacionIncluida: matchedPo.instalacionIncluida ?? (r.informacion_general_instalacion_incluida ?? true),
            monto: matchedPo.monto || r.total_general_cotizacion || 0,
            cliente: matchedPo.cliente || r.informacion_general_cliente || '',
            proyecto: matchedPo.proyecto || r.informacion_general_proyecto || '',
            folioRefCRM: matchedPo.folioRefCRM || r.informacion_general_folio
          };
        }
      }
    }

    const originIndicator = fetchedViaRest ? "Canal REST Directo HTTP" : "Software Development Kit (SDK) Fallback";

    return {
      success: true,
      records,
      contacts,
      auditLogs,
      purchaseOrders,
      message: `¡Carga consolidada exitosa! Se importaron ${records.length} expedientes, ${contacts.length} contactos, ${purchaseOrders.length} órdenes de compra y ${auditLogs.length} logs vía "${getResolvedCRMTableName()}", "${getResolvedContactsTableName()}", "${getResolvedOCTableName()}" y "${getResolvedAuditLogsTableName()}" [${originIndicator}].`
    };

  } catch (error: any) {
    return {
      success: false,
      records: [],
      contacts: [],
      auditLogs: [],
      purchaseOrders: [],
      message: `Fallo durante el mapeo de datos locales: ${error.message || error}`
    };
  }
}

/**
 * Pushes/Upserts a single PurchaseOrder to Supabase DB_OC
 */
export async function pushPurchaseOrderToSupabase(
  url: string,
  key: string,
  po: PurchaseOrder
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    let numericId = parseInt(po.id.replace(/\D/g, ''), 10);
    if (isNaN(numericId)) {
      let hash = 0;
      for (let i = 0; i < po.id.length; i++) {
        hash = (hash * 31 + po.id.charCodeAt(i)) & 0x7FFFFFFF;
      }
      numericId = hash || Math.floor(Math.random() * 10000000);
    }

    const standardPayload: any = {
      id: numericId,
      moneda: po.moneda,
      folio_oc: po.folioOC,
      link_oc: po.linkOC,
      fecha_inicio: po.fechaInicio,
      instalacion: po.instalacionIncluida,
      monto: po.monto,
      cliente: po.cliente,
      proyecto: po.proyecto,
      folio_ref_crm: po.folioRefCRM
    };

    const payload: any = { id: numericId };

    if (knownOCTableColumns.length > 0) {
      for (const col of knownOCTableColumns) {
        if (col === 'id') continue;
        if (standardPayload[col] !== undefined) {
          payload[col] = standardPayload[col];
        } else {
          const normCol = col.toLowerCase().replace(/[\s_-]/g, '');
          let matched = false;
          for (const k of Object.keys(standardPayload)) {
            if (k.toLowerCase().replace(/[\s_-]/g, '') === normCol) {
              payload[col] = standardPayload[k];
              matched = true;
              break;
            }
          }
        }
      }
    } else {
      payload.moneda = po.moneda;
    }

    const { error } = await client
      .from(getResolvedOCTableName())
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error al subir Orden de Compra a Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al subir Orden de Compra:', err);
    return false;
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
    const rawHw = record.total_hardware_cotizacion;
    const rawServ = record.total_servicios_cotizacion;

    const hardware = (rawHw === null || rawHw === undefined || String(rawHw).trim() === '') ? null : Number(rawHw);
    const servicios = (rawServ === null || rawServ === undefined || String(rawServ).trim() === '') ? null : Number(rawServ);

    // ENFOQUE ADAPTATIVO: Preservamos íntegramente los cálculos legítimos enviados por la aplicación (IVA 16% e Importe Neto)
    const subtotal = record.total_subtotal_cotizacion !== null && record.total_subtotal_cotizacion !== undefined
      ? Number(record.total_subtotal_cotizacion)
      : ((hardware !== null ? hardware : 0) + (servicios !== null ? servicios : 0));
      
    const iva = record.total_iva_cotizacion !== null && record.total_iva_cotizacion !== undefined 
      ? Number(record.total_iva_cotizacion) 
      : 0;
      
    const general = record.total_general_cotizacion !== null && record.total_general_cotizacion !== undefined 
      ? Number(record.total_general_cotizacion) 
      : subtotal + iva;

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
      estado_proyecto: record.estado_proyecto,
      status_proyecto: record.status_proyecto,
      folio_orden_compra: record.folio_orden_compra || null,
      link_orden_compra: record.link_orden_compra || null,
      fecha_inicio_proyecto: record.fecha_inicio_proyecto || null,
      informacion_general_instalacion_incluida: record.informacion_general_instalacion_incluida ?? null,
      notas_comerciales: record.notas_comerciales,
      acciones_seguimiento: Array.isArray(record.acciones_seguimiento) ? JSON.stringify(record.acciones_seguimiento) : record.acciones_seguimiento,
      sustituye_folio_anterior: record.sustituye_folio_anterior || null,
      etapa: record.etapa || null,
      nivel_termo: record.nivel_termo || record.status_proyecto || null,
      prioridad: record.prioridad !== undefined && record.prioridad !== null ? Number(record.prioridad) : 0,
      estado: record.estado || record.estado_proyecto || null,
      
      // Nuevos campos
      fecha_cambio_etapa: record.fecha_cambio_etapa || null,
      stagnation_days_limit: record.stagnation_days_limit !== undefined && record.stagnation_days_limit !== null ? Number(record.stagnation_days_limit) : 5,
      checklist_tasks: record.checklist_tasks || null,
      __tareas: record.__tareas || [],
      contacto_asignado_id: record.contacto_asignado_id || null,
      responsable: record.responsable || null,
      tags: record.tags || null,
      contacto_nombre: record.contacto_nombre || null,
      contacto_puesto: record.contacto_puesto || null,
      contacto_email: record.contacto_email || null,
      contacto_telefono: record.contacto_telefono || null
    };

    if (knownCRMTableColumns.includes('prioridad_nivel')) {
      standardPayload.prioridad_nivel = record.status_proyecto || null;
    }

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
      estado_proyecto: record.estado_proyecto,
      status: record.status_proyecto,
      folio_oc: record.folio_orden_compra || null,
      link_oc: record.link_orden_compra || null,
      fecha_inicio: record.fecha_inicio_proyecto || null,
      instalacion: record.informacion_general_instalacion_incluida ?? null,
      notas: record.notas_comerciales,
      acciones: record.acciones_seguimiento,
      sustituye: record.sustituye_folio_anterior || null,
      prioridad: record.prioridad !== undefined && record.prioridad !== null ? Number(record.prioridad) : 0,
      etapa: record.etapa || null,
      nivel_termo: record.nivel_termo || record.status_proyecto || null,
      estado: record.estado || record.estado_proyecto || null,
      
      // Nuevos campos
      fecha_cambio_etapa: record.fecha_cambio_etapa || null,
      stagnation_days_limit: record.stagnation_days_limit !== undefined && record.stagnation_days_limit !== null ? Number(record.stagnation_days_limit) : 5,
      checklist_tasks: record.checklist_tasks || null,
      __tareas: record.__tareas || [],
      contacto_asignado_id: record.contacto_asignado_id || null,
      responsable: record.responsable || null,
      tags: record.tags || null,
      contacto_nombre: record.contacto_nombre || null,
      contacto_puesto: record.contacto_puesto || null,
      contacto_email: record.contacto_email || null,
      contacto_telefono: record.contacto_telefono || null
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
 * Deletes multiple CRMRecords from Supabase in batch
 */
export async function deleteCRMRecordsFromSupabase(
  url: string,
  key: string,
  recordIds: string[]
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const validUUIDs = recordIds.map(toValidUUID);
    const { error } = await client
      .from(getResolvedCRMTableName())
      .delete()
      .in('id', validUUIDs);

    if (error) {
      console.error('Error al eliminar expedientes múltiples en Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error de red al eliminar múltiples en Supabase:', err);
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
    const table = getResolvedContactsTableName();
    const isContactosTable = table === 'Contactos' || table === 'contactos';

    // Build standard payloads
    const standardPayload: any = {
      // English keys
      id: contact.id,
      nombre: contact.nombre,
      puesto: contact.puesto,
      cliente: contact.cliente,
      planta: contact.planta,
      email: contact.email,
      telefono: contact.telefono,
      esEnlaceComercial: contact.esEnlaceComercial,
      tipo: contact.tipo || '',
      organizacion: contact.organizacion || '',
      prefijo_sufijo: contact.prefijoSufijo || '',
      pais: contact.pais || '',
      estado: contact.estado || '',
      ciudad: contact.ciudad || '',
      direccion: contact.direccion || '',
      nombre_ubicacion: contact.nombreUbicacion || '',
      empresa: contact.empresa || contact.cliente,

      // Spanish keys
      "ID": contact.id,
      "Nombre": contact.nombre,
      "Puesto": contact.puesto,
      "Cliente": contact.cliente,
      "Planta": contact.planta,
      "Correo": contact.email || contact.id,
      "Teléfono": contact.telefono,
      "Tipo": contact.tipo || '',
      "Organización": contact.organizacion || '',
      "Prefijo/Sufijo": contact.prefijoSufijo || '',
      "Nombre de la Planta": contact.planta || '',
      "Pais": contact.pais || '',
      "Estado": contact.estado || '',
      "Ciudad": contact.ciudad || '',
      "Dirección": contact.direccion || '',
      "Nombre de la ubicación para su identificación": contact.nombreUbicacion || '',
      "Empresa": contact.empresa || contact.cliente,
      "Ubicación": contact.nombreUbicacion || contact.ciudad || ''
    };

    const payload: any = {};

    if (knownContactsColumns.length > 0) {
      for (const col of knownContactsColumns) {
        if (standardPayload[col] !== undefined) {
          payload[col] = standardPayload[col];
        } else {
          // Normalize column key (ignoring accents, casing, spaces and underscores)
          const normCol = col.toLowerCase().replace(/[\s_-]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m] || m));
          for (const k of Object.keys(standardPayload)) {
            const normK = k.toLowerCase().replace(/[\s_-]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m] || m));
            if (normK === normCol) {
              payload[col] = standardPayload[k];
              break;
            }
          }
        }
      }
    } else {
      if (isContactosTable) {
        payload["ID"] = contact.id;
        payload["Nombre"] = contact.nombre;
        payload["Correo"] = contact.email || contact.id;
        payload["Teléfono"] = contact.telefono;
        payload["Puesto"] = contact.puesto;
        payload["Empresa"] = contact.empresa || contact.cliente;
        payload["Tipo"] = contact.tipo || '';
        payload["Cliente"] = contact.cliente;
        payload["Organización"] = contact.organizacion || '';
        payload["Planta"] = contact.planta;
        payload["Ubicación"] = contact.nombreUbicacion || contact.ciudad || '';
      } else {
        payload.id = contact.id;
        payload.nombre = contact.nombre;
        payload.puesto = contact.puesto;
        payload.cliente = contact.cliente;
        payload.planta = contact.planta;
        payload.email = contact.email;
        payload.telefono = contact.telefono;
        payload.esEnlaceComercial = contact.esEnlaceComercial;
        payload.tipo = contact.tipo || '',
        payload.organizacion = contact.organizacion || '',
        payload.prefijo_sufijo = contact.prefijoSufijo || '',
        payload.pais = contact.pais || '',
        payload.estado = contact.estado || '',
        payload.ciudad = contact.ciudad || '',
        payload.direccion = contact.direccion || '',
        payload.nombre_ubicacion = contact.nombreUbicacion || '',
        payload.empresa = contact.empresa || contact.cliente
      }
    }

    let onConflictCol = 'id';
    if (knownContactsColumns.includes('ID')) {
      onConflictCol = 'ID';
    } else if (knownContactsColumns.includes('id')) {
      onConflictCol = 'id';
    } else if (knownContactsColumns.includes('Correo')) {
      onConflictCol = 'Correo';
    } else if (knownContactsColumns.includes('correo')) {
      onConflictCol = 'correo';
    } else if (table === 'Contactos') {
      onConflictCol = 'ID';
    } else if (table === 'contactos') {
      onConflictCol = 'id';
    }

    const { error } = await client
      .from(table)
      .upsert(payload, { onConflict: onConflictCol });

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
  contactId: string,
  contactEmail?: string
): Promise<boolean> {
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    const table = getResolvedContactsTableName();
    let query = client.from(table).delete();

    if (knownContactsColumns.includes('ID')) {
      query = query.eq('ID', contactId);
    } else if (knownContactsColumns.includes('id')) {
      query = query.eq('id', contactId);
    } else if (knownContactsColumns.includes('Correo')) {
      const emailToDelete = contactEmail || contactId;
      query = query.eq('Correo', emailToDelete);
    } else if (knownContactsColumns.includes('correo')) {
      const emailToDelete = contactEmail || contactId;
      query = query.eq('correo', emailToDelete);
    } else if (table === 'Contactos') {
      const emailToDelete = contactEmail || contactId;
      query = query.eq('Correo', emailToDelete);
    } else if (table === 'contactos') {
      const emailToDelete = contactEmail || contactId;
      query = query.eq('correo', emailToDelete);
    } else {
      query = query.eq('id', contactId);
    }

    const { error } = await query;

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
    // 1. Batch upload CRM records
    const recordsPayloads = records.map(rec => {
      const hardware = Number(rec.total_hardware_cotizacion) || 0;
      const servicios = Number(rec.total_servicios_cotizacion) || 0;
      const subtotal = hardware + servicios;
      const iva = 0;
      const general = subtotal;
      const validUUID = toValidUUID(rec.id);

      const standardPayload: any = {
        id: validUUID,
        informacion_general_folio: rec.informacion_general_folio,
        fecha_registro: rec.fecha_registro,
        informacion_general_fecha: rec.fecha_registro,
        informacion_general_cliente: rec.informacion_general_cliente,
        informacion_general_planta: rec.informacion_general_planta,
        cliente_pais: rec.cliente_pais,
        cliente_ubicacion: rec.cliente_ubicacion,
        informacion_general_proyecto: rec.informacion_general_proyecto,
        informacion_general_link_cotizacion: rec.informacion_general_link_cotizacion,
        total_hardware_cotizacion: hardware,
        total_servicios_cotizacion: servicios,
        total_subtotal_cotizacion: subtotal,
        total_iva_cotizacion: iva,
        total_general_cotizacion: general,
        informacion_general_moneda: rec.informacion_general_moneda,
        estado_proyecto: rec.estado_proyecto,
        status_proyecto: rec.status_proyecto,
        folio_orden_compra: rec.folio_orden_compra || null,
        link_orden_compra: rec.link_orden_compra || null,
        fecha_inicio_proyecto: rec.fecha_inicio_proyecto || null,
        informacion_general_instalacion_incluida: rec.informacion_general_instalacion_incluida ?? null,
        notas_comerciales: rec.notas_comerciales,
        acciones_seguimiento: Array.isArray(rec.acciones_seguimiento) ? JSON.stringify(rec.acciones_seguimiento) : rec.acciones_seguimiento,
        sustituye_folio_anterior: rec.sustituye_folio_anterior || null,
        etapa: rec.etapa || null,
        nivel_termo: rec.nivel_termo || rec.status_proyecto || null,
        prioridad: rec.prioridad !== undefined && rec.prioridad !== null ? Number(rec.prioridad) : 0,
        estado: rec.estado || rec.estado_proyecto || null
      };

      if (knownCRMTableColumns.includes('prioridad_nivel')) {
        standardPayload.prioridad_nivel = rec.status_proyecto || null;
      }

      const shortPayload: any = {
        id: validUUID,
        folio: rec.informacion_general_folio,
        fecha_registro: rec.fecha_registro,
        informacion_general_fecha: rec.fecha_registro,
        cliente: rec.informacion_general_cliente,
        planta: rec.informacion_general_planta,
        pais: rec.cliente_pais,
        ubicacion: rec.cliente_ubicacion,
        proyecto: rec.informacion_general_proyecto,
        link_cotizacion: rec.informacion_general_link_cotizacion,
        hardware: hardware,
        servicios: servicios,
        subtotal: subtotal,
        iva: iva,
        total: general,
        moneda: rec.informacion_general_moneda,
        estado_proyecto: rec.estado_proyecto,
        status: rec.status_proyecto,
        folio_oc: rec.folio_orden_compra || null,
        link_oc: rec.link_orden_compra || null,
        fecha_inicio: rec.fecha_inicio_proyecto || null,
        instalacion: rec.informacion_general_instalacion_incluida ?? null,
        notas: rec.notas_comerciales,
        acciones: Array.isArray(rec.acciones_seguimiento) ? JSON.stringify(rec.acciones_seguimiento) : rec.acciones_seguimiento,
        sustituye: rec.sustituye_folio_anterior || null,
        prioridad: rec.prioridad !== undefined && rec.prioridad !== null ? Number(rec.prioridad) : 0,
        etapa: rec.etapa || null,
        nivel_termo: rec.nivel_termo || rec.status_proyecto || null,
        estado: rec.estado || rec.estado_proyecto || null
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
        const targetTable = getResolvedCRMTableName();
        const useStandard = targetTable === 'crm_records' || targetTable === 'DB CRM' || targetTable === 'DB_CRM' || targetTable === 'db_crm';
        Object.assign(payload, useStandard ? standardPayload : shortPayload);
      }
      return payload;
    });

    if (recordsPayloads.length > 0) {
      const { error: recErr } = await client
        .from(getResolvedCRMTableName())
        .upsert(recordsPayloads, { onConflict: 'id' });
      if (recErr) throw recErr;
    }

    // 2. Batch upload contacts
    const contactsTable = getResolvedContactsTableName();
    const isContactosTable = contactsTable === 'Contactos' || contactsTable === 'contactos';

    const contactsPayloads = contacts.map(con => {
      const validUUID = toValidUUID(con.id);
      
      const standardPayload: any = {
        // English keys
        id: validUUID,
        nombre: con.nombre,
        puesto: con.puesto,
        cliente: con.cliente,
        planta: con.planta,
        email: con.email,
        telefono: con.telefono,
        esEnlaceComercial: con.esEnlaceComercial,
        tipo: con.tipo || '',
        organizacion: con.organizacion || '',
        prefijo_sufijo: con.prefijoSufijo || '',
        pais: con.pais || '',
        estado: con.estado || '',
        ciudad: con.ciudad || '',
        direccion: con.direccion || '',
        nombre_ubicacion: con.nombreUbicacion || '',
        empresa: con.empresa || con.cliente,

        // Spanish keys
        "ID": validUUID,
        "Nombre": con.nombre,
        "Puesto": con.puesto,
        "Cliente": con.cliente,
        "Planta": con.planta,
        "Correo": con.email || con.id,
        "Teléfono": con.telefono,
        "Tipo": con.tipo || '',
        "Organización": con.organizacion || '',
        "Prefijo/Sufijo": con.prefijoSufijo || '',
        "Nombre de la Planta": con.planta || '',
        "Pais": con.pais || '',
        "Estado": con.estado || '',
        "Ciudad": con.ciudad || '',
        "Dirección": con.direccion || '',
        "Nombre de la ubicación para su identificación": con.nombreUbicacion || '',
        "Empresa": con.empresa || con.cliente,
        "Ubicación": con.nombreUbicacion || con.ciudad || ''
      };

      const payload: any = {};
      if (knownContactsColumns.length > 0) {
        for (const col of knownContactsColumns) {
          if (standardPayload[col] !== undefined) {
            payload[col] = standardPayload[col];
          } else {
            // Normalize column key (ignoring accents, casing, spaces and underscores)
            const normCol = col.toLowerCase().replace(/[\s_-]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m] || m));
            for (const k of Object.keys(standardPayload)) {
              const normK = k.toLowerCase().replace(/[\s_-]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m] || m));
              if (normK === normCol) {
                payload[col] = standardPayload[k];
                break;
              }
            }
          }
        }
      } else {
        if (isContactosTable) {
          payload["ID"] = validUUID;
          payload["Nombre"] = con.nombre;
          payload["Correo"] = con.email || con.id;
          payload["Teléfono"] = con.telefono;
          payload["Puesto"] = con.puesto;
          payload["Empresa"] = con.empresa || con.cliente;
          payload["Tipo"] = con.tipo || '';
          payload["Cliente"] = con.cliente;
          payload["Organización"] = con.organizacion || '';
          payload["Planta"] = con.planta;
          payload["Ubicación"] = con.nombreUbicacion || con.ciudad || '';
        } else {
          payload.id = validUUID;
          payload.nombre = con.nombre;
          payload.puesto = con.puesto;
          payload.cliente = con.cliente;
          payload.planta = con.planta;
          payload.email = con.email;
          payload.telefono = con.telefono;
          payload.esEnlaceComercial = con.esEnlaceComercial;
          payload.tipo = con.tipo || '';
          payload.organizacion = con.organizacion || '';
          payload.prefijo_sufijo = con.prefijoSufijo || '';
          payload.pais = con.pais || '';
          payload.estado = con.estado || '';
          payload.ciudad = con.ciudad || '';
          payload.direccion = con.direccion || '';
          payload.nombre_ubicacion = con.nombreUbicacion || '';
          payload.empresa = con.empresa || con.cliente;
        }
      }
      return payload;
    });

    if (contactsPayloads.length > 0) {
      let onConflictCol = 'id';
      if (knownContactsColumns.includes('ID')) {
        onConflictCol = 'ID';
      } else if (knownContactsColumns.includes('id')) {
        onConflictCol = 'id';
      } else if (knownContactsColumns.includes('Correo')) {
        onConflictCol = 'Correo';
      } else if (knownContactsColumns.includes('correo')) {
        onConflictCol = 'correo';
      } else if (contactsTable === 'Contactos') {
        onConflictCol = 'ID';
      } else if (contactsTable === 'contactos') {
        onConflictCol = 'id';
      }

      const { error: conErr } = await client
        .from(contactsTable)
        .upsert(contactsPayloads, { onConflict: onConflictCol });
      if (conErr) throw conErr;
    }

    // 3. Batch upload audit logs
    const auditPayloads = auditLogs.map(aud => {
      const validUUID = toValidUUID(aud.id);
      const standardPayload: any = {
        id: validUUID,
        fecha: aud.fecha,
        accion: aud.accion,
        operador: aud.operador,
        perfil: aud.perfil,
        detalles: aud.detalles
      };
      const payload: any = { id: validUUID };
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
      return payload;
    });

    if (auditPayloads.length > 0) {
      const { error: audErr } = await client
        .from(getResolvedAuditLogsTableName())
        .upsert(auditPayloads, { onConflict: 'id' });
      if (audErr) throw audErr;
    }

    return {
      success: true,
      message: `Exportación consolidada exitosa. Se subieron ${records.length} expedientes, ${contacts.length} contactos y ${auditLogs.length} logs en 3 transacciones atómicas de bloque a Supabase.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error al realizar carga masiva por lotes: ${error.message}`,
      rawError: error
    };
  }
}

// ==========================================
// FUNCIONES DE TIEMPO REAL (WEB-SOCKETS)
// ==========================================

/**
 * Obtiene la configuración del tablero de CRM (Columnas y Límites)
 */
export async function getCRMSettings(urlInput?: string, keyInput?: string): Promise<{ id: string; kanban_columns: string[]; wip_limits: Record<string, number>; exchange_rate_usd_mxn?: number } | null> {
  const url = urlInput || localStorage.getItem('verse_supabase_url') || '';
  const key = keyInput || localStorage.getItem('verse_supabase_key') || '';
  const client = getSupabaseClient(url, key);
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('crm_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error al obtener crm_settings:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('Excepción al obtener crm_settings:', err);
    return null;
  }
}

/**
 * Guarda o actualiza la configuración del tablero de CRM (Columnas y Límites)
 */
export async function updateCRMSettings(
  settings: { id?: string; kanban_columns: string[]; wip_limits: Record<string, number>; exchange_rate_usd_mxn?: number },
  urlInput?: string,
  keyInput?: string
): Promise<boolean> {
  const url = urlInput || localStorage.getItem('verse_supabase_url') || '';
  const key = keyInput || localStorage.getItem('verse_supabase_key') || '';
  const client = getSupabaseClient(url, key);
  if (!client) return false;

  try {
    let error;
    if (settings.id) {
      const { error: err } = await client
        .from('crm_settings')
        .update({
          kanban_columns: settings.kanban_columns,
          wip_limits: settings.wip_limits,
          ...(settings.exchange_rate_usd_mxn !== undefined ? { exchange_rate_usd_mxn: settings.exchange_rate_usd_mxn } : {})
        })
        .eq('id', settings.id);
      error = err;
    } else {
      const { error: err } = await client
        .from('crm_settings')
        .upsert({
          kanban_columns: settings.kanban_columns,
          wip_limits: settings.wip_limits,
          ...(settings.exchange_rate_usd_mxn !== undefined ? { exchange_rate_usd_mxn: settings.exchange_rate_usd_mxn } : {})
        });
      error = err;
    }

    if (error) {
      console.error('Error al guardar crm_settings:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Excepción al guardar crm_settings:', err);
    return false;
  }
}

/**
 * Servicio automatizado para verificar y actualizar el tipo de cambio diario
 * Adaptado para usar la inicialización dinámica de getSupabaseClient
 */
export const syncDailyExchangeRate = async (urlInput?: string, keyInput?: string): Promise<number> => {
  const url = urlInput || localStorage.getItem('verse_supabase_url') || '';
  const key = keyInput || localStorage.getItem('verse_supabase_key') || '';
  const client = getSupabaseClient(url, key);
  
  const defaultRate = 17.05;

  if (!client) {
    console.warn("⚠️ No hay cliente Supabase disponible para sincronizar el tipo de cambio. Usando fallback local.");
    return defaultRate;
  }

  try {
    // 1. Obtener la configuración actual de Supabase de forma segura (tolerante a duplicados)
    const { data: settingsData, error: fetchError } = await client
      .from('crm_settings')
      .select('id, exchange_rate_usd_mxn, exchange_rate_updated_at')
      .order('exchange_rate_updated_at', { ascending: false }) // Traer siempre el más reciente
      .limit(1);

    if (fetchError) throw fetchError;

    // Extraemos el primer registro de la lista de forma segura
    const settings = settingsData && settingsData.length > 0 ? settingsData[0] : null;

    const todayStr = new Date().toISOString().split('T')[0]; // Ej: "2026-03-30"
    
    // Si ya se actualizó hoy, retornamos el valor existente de inmediato
    if (settings?.exchange_rate_updated_at) {
      const lastUpdateStr = new Date(settings.exchange_rate_updated_at).toISOString().split('T')[0];
      if (todayStr === lastUpdateStr && settings.exchange_rate_usd_mxn) {
        return Number(settings.exchange_rate_usd_mxn);
      }
    }

    // 2. Si es un nuevo día, consultamos la API gratuita de tipo de cambio
    console.log("🔄 Sincronizando tipo de cambio del día de hoy con API externa...");
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Error al consultar la API de tipos de cambio');
    
    const apiData = await response.json();
    const newRate = apiData?.rates?.MXN;

    if (!newRate || typeof newRate !== 'number') {
      throw new Error('Formato de respuesta de API inválido');
    }

    // 3. Guardar el nuevo tipo de cambio en Supabase
    if (settings?.id) {
      await client
        .from('crm_settings')
        .update({
          exchange_rate_usd_mxn: newRate,
          exchange_rate_updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);
    } else {
      await client
        .from('crm_settings')
        .insert([{
          exchange_rate_usd_mxn: newRate,
          exchange_rate_updated_at: new Date().toISOString()
        }]);
    }

    console.log(`✅ Tipo de Cambio actualizado en Base de Datos: $${newRate} MXN/USD`);
    return newRate;

  } catch (error) {
    console.error("🚨 Falló la automatización del tipo de cambio. Usando fallback seguro.", error);
    return defaultRate;
  }
};

/**
 * Escucha en vivo los cambios en la configuración del tablero (Columnas y Límites)
 */
export const subscribeToCRMSettings = (
  onUpdate: (payload: any) => void,
  urlInput?: string,
  keyInput?: string
) => {
  const url = urlInput || localStorage.getItem('verse_supabase_url') || '';
  const key = keyInput || localStorage.getItem('verse_supabase_key') || '';
  const client = getSupabaseClient(url, key);
  if (!client) return null;

  // Generamos un ID único para evitar choques con el Strict Mode de React
  const uniqueChannelId = `crm_settings_changes_${Math.random().toString(36).substring(7)}`;

  const channel = client
    .channel(uniqueChannelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'crm_settings' },
      (payload) => {
        console.log('📡 [Realtime] Cambio detectado en crm_settings:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  return channel; // Retornamos el canal para poder cerrarlo si el usuario cambia de pantalla
};

/**
 * Escucha en vivo los movimientos, creaciones o eliminaciones de los Leads/Proyectos
 */
export const subscribeToCRMRecords = (url: string, key: string, onUpdate: (payload: any) => void) => {
  const client = getSupabaseClient(url, key);
  if (!client) return null;

  // Generamos un ID único aquí también
  const uniqueChannelId = `db_crm_changes_${Math.random().toString(36).substring(7)}`;

  const channel = client
    .channel(uniqueChannelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: getResolvedCRMTableName() },
      (payload) => {
        console.log('📡 [Realtime] Cambio detectado en DB CRM:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  return channel;
};

/**
 * FASE 3: Descarga el siguiente bloque de registros CRM para paginación
 */
export async function loadMoreCRMRecords(url: string, key: string, offset: number, limit: number = 150) {
  const client = getSupabaseClient(url, key);
  if (!client) return { success: false, records: [] };

  try {
    const { data, error } = await client
      .from(getResolvedCRMTableName())
      .select('*')
      .range(offset, offset + limit - 1); // Rango dinámico (ej. 150 a 299)

    if (error) {
      console.error('Error al paginar registros CRM:', error);
      return { success: false, records: [] };
    }

    // Mapeamos los datos en crudo usando tu algoritmo central
    return { success: true, records: data.map(mapRawCRMRecord) };
  } catch (err) {
    console.error('Excepción de red al paginar CRM:', err);
    return { success: false, records: [] };
  }
}

export const SUPABASE_SQL_INSTRUCTIONS = `-- COPIA Y PEGA ESTE SCRIPT EN EL EDITOR SQL (SQL EDITOR) DE TU PROYECTO SUPABASE

-- MIGRACIÓN DE COMPATIBILIDAD (Si ya tienes las tablas creadas, ejecuta esto primero):
-- ALTER TABLE "DB CRM" ADD COLUMN IF NOT EXISTS etapa text;
-- ALTER TABLE "DB CRM" ADD COLUMN IF NOT EXISTS nivel_termo text;
-- ALTER TABLE "DB CRM" ADD COLUMN IF NOT EXISTS prioridad integer DEFAULT 0;
-- ALTER TABLE "DB CRM" ADD COLUMN IF NOT EXISTS estado text;

-- 1. Tabla de Expedientes CRM ("DB CRM")
create table if not exists "DB CRM" (
  id uuid primary key default gen_random_uuid(),
  fecha_registro text,
  status_proyecto text,
  folio_orden_compra text,
  link_orden_compra text,
  informacion_general_folio text,
  informacion_general_link_cotizacion text,
  informacion_general_fecha text,
  informacion_general_cliente text,
  informacion_general_planta text,
  cliente_ubicacion text,
  cliente_pais text,
  informacion_general_nombre_archivo text,
  informacion_general_proyecto text,
  informacion_general_moneda text,
  informacion_general_tiempo_entrega text,
  informacion_general_garantia text,
  informacion_general_incoterm text,
  informacion_general_instalacion_incluida boolean,
  cotizacion_sustituye_a text,
  condicionantes_comerciales text,
  contacto_nombre text,
  contacto_puesto text,
  contacto_email text,
  contacto_telefono text,
  total_subtotal_cotizacion float8,
  total_iva_cotizacion float8,
  total_general_cotizacion float8,
  total_hardware_cotizacion float8,
  total_servicios_cotizacion float8,
  numero_partidas int8,
  notas_comerciales text,
  acciones_seguimiento text,
  fecha_inicio_proyecto text,
  _system_fileId text,
  __partidas jsonb,
  estado_proyecto text,

  -- Nuevos campos para funcionamiento del Kanban
  etapa text,
  nivel_termo text,
  prioridad integer default 0,
  estado text
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
  tipo text,
  organizacion text,
  prefijo_sufijo text,
  pais text,
  estado text,
  ciudad text,
  direccion text,
  nombre_ubicacion text,
  empresa text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla de Contactos (Exactamente como se solicita con nombre de tabla 'contactos' y columnas exactas):
create table if not exists contactos (
  "ID" text primary key,
  "Nombre" text,
  "Correo" text,
  "Teléfono" text,
  "Puesto" text,
  "Empresa" text,
  "Tipo" text,
  "Cliente" text,
  "Organización" text,
  "Planta" text,
  "Ubicación" text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla de Contactos con C mayúscula y columnas exactas en español:
create table if not exists "Contactos" (
  "ID" text primary key,
  "Nombre" text,
  "Correo" text,
  "Teléfono" text,
  "Puesto" text,
  "Empresa" text,
  "Tipo" text,
  "Cliente" text,
  "Organización" text,
  "Planta" text,
  "Ubicación" text,
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

-- 4. Tabla de Órdenes de Compra (DB_OC o DB OC)
create table if not exists "DB_OC" (
  id bigint primary key,
  moneda text,
  folio_oc text,
  link_oc text,
  fecha_inicio text,
  instalacion boolean,
  monto numeric,
  cliente text,
  proyecto text,
  folio_ref_crm text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists "DB OC" (
  id bigint primary key,
  moneda text,
  folio_oc text,
  link_oc text,
  fecha_inicio text,
  instalacion boolean,
  monto numeric,
  cliente text,
  proyecto text,
  folio_ref_crm text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabla de Gestión de Usuarios y Accesos (Usuarios o usuarios)
create table if not exists "Usuarios" (
  id text primary key,
  correo text unique not null,
  nombre text,
  rol text,
  estado text,
  "fechaRegistro" text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists usuarios (
  id text primary key,
  correo text unique not null,
  nombre text,
  rol text,
  estado text,
  "fechaRegistro" text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Tabla de Configuración de Tablero CRM (Columnas y Límites)
create table if not exists crm_settings (
  id uuid primary key default gen_random_uuid(),
  kanban_columns text[] default array['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'],
  wip_limits jsonb default '{}'::jsonb,
  exchange_rate_usd_mxn numeric default 17.05,
  exchange_rate_updated_at text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- ========================================================
-- HABILITAR SEGURIDAD (RLS) Y CREAR POLÍTICAS PERMISIVAS
-- ========================================================

-- Tabla con espacio: "DB CRM"
alter table if exists "DB CRM" enable row level security;
drop policy if exists "Permiso lectura libre" on "DB CRM";
drop policy if exists "Permiso escritura libre" on "DB CRM";
drop policy if exists "Permiso edicion libre" on "DB CRM";
drop policy if exists "Permiso borrado libre" on "DB CRM";
create policy "Permiso lectura libre" on "DB CRM" for select using (true);
create policy "Permiso escritura libre" on "DB CRM" for insert with check (true);
create policy "Permiso edicion libre" on "DB CRM" for update using (true);
create policy "Permiso borrado libre" on "DB CRM" for delete using (true);

-- Tabla: contacts
alter table contacts enable row level security;
drop policy if exists "Permiso lectura libre" on contacts;
drop policy if exists "Permiso escritura libre" on contacts;
drop policy if exists "Permiso edicion libre" on contacts;
drop policy if exists "Permiso borrado libre" on contacts;
create policy "Permiso lectura libre" on contacts for select using (true);
create policy "Permiso escritura libre" on contacts for insert with check (true);
create policy "Permiso edicion libre" on contacts for update using (true);
create policy "Permiso borrado libre" on contacts for delete using (true);

-- Tabla con C mayúscula: "Contactos"
alter table if exists "Contactos" enable row level security;
drop policy if exists "Permiso lectura libre" on "Contactos";
drop policy if exists "Permiso escritura libre" on "Contactos";
drop policy if exists "Permiso edicion libre" on "Contactos";
drop policy if exists "Permiso borrado libre" on "Contactos";
create policy "Permiso lectura libre" on "Contactos" for select using (true);
create policy "Permiso escritura libre" on "Contactos" for insert with check (true);
create policy "Permiso edicion libre" on "Contactos" for update using (true);
create policy "Permiso borrado libre" on "Contactos" for delete using (true);

-- Tabla con c minúscula: contactos
alter table if exists contactos enable row level security;
drop policy if exists "Permiso lectura libre" on contactos;
drop policy if exists "Permiso escritura libre" on contactos;
drop policy if exists "Permiso edicion libre" on contactos;
drop policy if exists "Permiso borrado libre" on contactos;
create policy "Permiso lectura libre" on contactos for select using (true);
create policy "Permiso escritura libre" on contactos for insert with check (true);
create policy "Permiso edicion libre" on contactos for update using (true);
create policy "Permiso borrado libre" on contactos for delete using (true);

-- Tabla: audit_logs
alter table audit_logs enable row level security;
drop policy if exists "Permiso lectura libre" on audit_logs;
drop policy if exists "Permiso escritura libre" on audit_logs;
drop policy if exists "Permiso edicion libre" on audit_logs;
drop policy if exists "Permiso borrado libre" on audit_logs;
create policy "Permiso lectura libre" on audit_logs for select using (true);
create policy "Permiso escritura libre" on audit_logs for insert with check (true);
create policy "Permiso edicion libre" on audit_logs for update using (true);
create policy "Permiso borrado libre" on audit_logs for delete using (true);

-- Tabla: "DB_OC"
alter table if exists "DB_OC" enable row level security;
drop policy if exists "Permiso lectura libre" on "DB_OC";
drop policy if exists "Permiso escritura libre" on "DB_OC";
drop policy if exists "Permiso edicion libre" on "DB_OC";
drop policy if exists "Permiso borrado libre" on "DB_OC";
create policy "Permiso lectura libre" on "DB_OC" for select using (true);
create policy "Permiso escritura libre" on "DB_OC" for insert with check (true);
create policy "Permiso edicion libre" on "DB_OC" for update using (true);
create policy "Permiso borrado libre" on "DB_OC" for delete using (true);

-- Tabla: "DB OC"
alter table if exists "DB OC" enable row level security;
drop policy if exists "Permiso lectura libre" on "DB OC";
drop policy if exists "Permiso escritura libre" on "DB OC";
drop policy if exists "Permiso edicion libre" on "DB OC";
drop policy if exists "Permiso borrado libre" on "DB OC";
create policy "Permiso lectura libre" on "DB OC" for select using (true);
create policy "Permiso escritura libre" on "DB OC" for insert with check (true);
create policy "Permiso edicion libre" on "DB OC" for update using (true);
create policy "Permiso borrado libre" on "DB OC" for delete using (true);

-- Tabla: "Usuarios"
alter table if exists "Usuarios" enable row level security;
drop policy if exists "Permiso lectura libre" on "Usuarios";
drop policy if exists "Permiso escritura libre" on "Usuarios";
drop policy if exists "Permiso edicion libre" on "Usuarios";
drop policy if exists "Permiso borrado libre" on "Usuarios";
create policy "Permiso lectura libre" on "Usuarios" for select using (true);
create policy "Permiso escritura libre" on "Usuarios" for insert with check (true);
create policy "Permiso edicion libre" on "Usuarios" for update using (true);
create policy "Permiso borrado libre" on "Usuarios" for delete using (true);

-- Tabla: usuarios
alter table if exists usuarios enable row level security;
drop policy if exists "Permiso lectura libre" on usuarios;
drop policy if exists "Permiso escritura libre" on usuarios;
drop policy if exists "Permiso edicion libre" on usuarios;
drop policy if exists "Permiso borrado libre" on usuarios;
create policy "Permiso lectura libre" on usuarios for select using (true);
create policy "Permiso escritura libre" on usuarios for insert with check (true);
create policy "Permiso edicion libre" on usuarios for update using (true);
create policy "Permiso borrado libre" on usuarios for delete using (true);

-- Tabla: crm_settings
alter table if exists crm_settings enable row level security;
drop policy if exists "Permiso lectura libre" on crm_settings;
drop policy if exists "Permiso escritura libre" on crm_settings;
drop policy if exists "Permiso edicion libre" on crm_settings;
drop policy if exists "Permiso borrado libre" on crm_settings;
create policy "Permiso lectura libre" on crm_settings for select using (true);
create policy "Permiso escritura libre" on crm_settings for insert with check (true);
create policy "Permiso edicion libre" on crm_settings for update using (true);
create policy "Permiso borrado libre" on crm_settings for delete using (true);
`;

// ==========================================
// MOTOR DE PRESENCIA GLOBAL Y BLOQUEOS (FASE 4)
// ==========================================

/**
 * Suscribe la sesión de la pestaña actual al canal de presencia global.
 * Soporta de forma nativa múltiples pestañas del mismo usuario sin pisar estados.
 */
export function subscribeToGlobalPresence(
  client: SupabaseClient,
  user: { name: string; email: string },
  onSync: (locks: Record<string, any>) => void
) {
  // ID determinista y exclusivo por pestaña del navegador
  const tabId = crypto.randomUUID(); 
  
  const room = client.channel('crm_global_presence', {
    config: { presence: { key: tabId } }
  });

  // Escucha universal ante entradas, salidas o mutaciones de foco comercial
  room.on('presence', { event: 'sync' }, () => {
    const state = room.presenceState();
    const currentLocks: Record<string, any> = {};
    
    // Iteramos sobre todos los hilos de conexión de la sala distribuida
    for (const [key, presences] of Object.entries(state)) {
      // Evaluamos el arreglo completo de presencias bajo este socket para evitar omisiones
      presences.forEach((active: any) => {
        if (active.editingRecordId) {
          currentLocks[active.editingRecordId] = {
            name: active.name,
            email: active.email,
            timestamp: active.timestamp,
            tabId: key
          };
        }
      });
    }
    // Despachamos el mapa consolidado de bloqueos directo al estado de React
    onSync(currentLocks);
  });

  room.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Anunciamos la entrada en vivo (online) sin capturar ningún registro inicialmente
      await room.track({
        name: user.name,
        email: user.email,
        editingRecordId: null,
        onlineAt: new Date().toISOString()
      });
    }
  });

  return room;
}

/**
 * Actualiza el estado de presencia de la pestaña actual para tomar o liberar un expediente.
 */
export async function setEditingRecord(room: any, recordId: string | null, user: { name: string; email: string }) {
  if (!room) return;
  // Transmitimos en caliente el ID del Lead abierto (o null si el vendedor cerró la vista)
  await room.track({
    name: user.name,
    email: user.email,
    editingRecordId: recordId,
    timestamp: new Date().toISOString()
  });
}

// ==========================================
// MOTOR DE ESCUCHA EN TIEMPO REAL (FASE 5)
// ==========================================

/**
 * Establece una suscripción universal y compartida a eventos de PostgreSQL.
 * Previene el agotamiento de cuotas (Channel Exhaustion) mediante multiplexación de sockets.
 */
export function subscribeToTableRealtime(
  client: any,
  tableName: string,
  onEvent: (payload: any) => void
) {
  if (!client || !tableName) return null;

  // 🛡️ CANAL DETERMINISTA: ID fijo por tabla para reutilización eficiente de canales concurrentes
  const channelId = `room_realtime_public_${tableName.toLowerCase().replace(/[\s-]/g, '_')}`;

  const channel = client
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload: any) => {
        console.log(`📡 [Realtime Centralizado] Mutación detectada en tabla "${tableName}":`, payload);
        onEvent(payload);
      }
    )
    .subscribe();

  return channel;
}


