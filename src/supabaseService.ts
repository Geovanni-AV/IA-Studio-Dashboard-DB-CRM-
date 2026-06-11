import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CRMRecord, Contact, AuditLog } from './types';

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

export function getSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  let cleanUrl = url.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  const cleanKey = key.trim();

  // Return null if using placeholder/demo values to avoid noisy startup connection errors
  if (
    cleanUrl === 'https://bkeyhvbr4b4eokigmdgftu.supabase.co' || 
    cleanKey === 'sb_secret_DMMi3TiTxGm8xYR4PmyMIw_kBiQW9jv'
  ) {
    return null;
  }

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
  tablesDetected: { records: boolean; contacts: boolean; logs: boolean };
}> {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (
    !cleanUrl || 
    !cleanKey || 
    cleanUrl.includes('bkeyhvbr4b4eokigmdgftu.supabase.co') || 
    cleanKey === 'sb_secret_DMMi3TiTxGm8xYR4PmyMIw_kBiQW9jv'
  ) {
    return {
      success: false,
      message: 'No se puede conectar con valores de demostración. Por favor configure la URL y Key reales de su propio proyecto Supabase.',
      tablesDetected: { records: false, contacts: false, logs: false }
    };
  }

  const client = getSupabaseClient(url, key);
  if (!client) {
    return {
      success: false,
      message: 'No se pudo inicializar el cliente. Verifique la URL y la Key.',
      tablesDetected: { records: false, contacts: false, logs: false }
    };
  }

  const status = { records: false, contacts: false, logs: false };
  let authOrNetworkError = false;
  let genericErrorMessage = '';

  const checkTable = async (tableName: string) => {
    try {
      const { error } = await client.from(tableName).select('id').limit(1);
      if (!error) {
        return { exists: true, error: null };
      }
      
      if (error.code === 'PGRST116') {
        return { exists: true, error: null };
      }
      
      // 42P01: Relation/Table does not exist. This proves we successfully authenticated and contacted Postgres!
      if (
        error.code === '42P01' || 
        error.message?.includes('does not exist') || 
        error.message?.includes('no existe la relación') || 
        String((error as any).status) === '404'
      ) {
        return { exists: false, error: null };
      }
      
      return { exists: false, error };
    } catch (err: any) {
      return { exists: false, error: err };
    }
  };

  // 1. Check crm_records
  const resRecords = await checkTable('crm_records');
  if (resRecords.exists) {
    status.records = true;
  } else if (resRecords.error) {
    authOrNetworkError = true;
    genericErrorMessage = resRecords.error.message || String(resRecords.error);
  }

  // 2. Check contacts
  if (!authOrNetworkError) {
    const resContacts = await checkTable('contacts');
    if (resContacts.exists) {
      status.contacts = true;
    } else if (resContacts.error) {
      authOrNetworkError = true;
      genericErrorMessage = resContacts.error.message || String(resContacts.error);
    }
  }

  // 3. Check audit_logs
  if (!authOrNetworkError) {
    const resLogs = await checkTable('audit_logs');
    if (resLogs.exists) {
      status.logs = true;
    } else if (resLogs.error) {
      authOrNetworkError = true;
      genericErrorMessage = resLogs.error.message || String(resLogs.error);
    }
  }

  if (authOrNetworkError) {
    return {
      success: false,
      message: `Error de conexión o autenticación con Supabase: ${genericErrorMessage}`,
      tablesDetected: status
    };
  }

  const allConnected = status.records && status.contacts && status.logs;
  if (allConnected) {
    return {
      success: true,
      message: '¡Conexión exitosa! Las 3 tablas requeridas fueron detectadas correctamente.',
      tablesDetected: status
    };
  } else {
    return {
      success: true, // True because connection details are verified as correct (we successfully reached DB!)
      message: '¡Conectado exitosamente con Supabase! Sin embargo, faltan una o más tablas requeridas de la base de datos. Copia y ejecuta el script SQL provisto abajo en tu consola de Supabase para crearlas.',
      tablesDetected: status
    };
  }
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
}> {
  const client = getSupabaseClient(url, key);
  if (!client) {
    return { success: false, records: [], contacts: [], auditLogs: [], message: 'Cliente Supabase no configurado.' };
  }

  try {
    // Fetch crm records
    const { data: recData, error: recErr } = await client
      .from('crm_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (recErr) throw new Error(`crm_records: ${recErr.message}`);

    // Fetch contacts
    const { data: conData, error: conErr } = await client
      .from('contacts')
      .select('*');

    if (conErr) throw new Error(`contacts: ${conErr.message}`);

    // Fetch audit logs
    const { data: audData, error: audErr } = await client
      .from('audit_logs')
      .select('*')
      .order('fecha', { ascending: false });

    if (audErr) throw new Error(`audit_logs: ${audErr.message}`);

    // Map any JSON column conversions if needed (acciones_seguimiento is stored as JSONB)
    const records: CRMRecord[] = (recData || []).map((r) => {
      const acciones_parsed = Array.isArray(r.acciones_seguimiento) 
        ? r.acciones_seguimiento 
        : (typeof r.acciones_seguimiento === 'string' 
            ? JSON.parse(r.acciones_seguimiento) 
            : []);
      
      const hardware = Number(r.total_hardware_cotizacion) || 0;
      const servicios = Number(r.total_servicios_cotizacion) || 0;
      const subtotal = hardware + servicios;
      const iva = parseFloat((subtotal * 0.16).toFixed(2));
      const general = parseFloat((subtotal + iva).toFixed(2));

      return {
        ...r,
        total_hardware_cotizacion: hardware,
        total_servicios_cotizacion: servicios,
        total_subtotal_cotizacion: subtotal,
        total_iva_cotizacion: iva,
        total_general_cotizacion: general,
        acciones_seguimiento: acciones_parsed
      };
    });

    const contacts: Contact[] = (conData || []).map((c) => {
      // Validate camelCase / snake_case / lowercase field for esEnlaceComercial
      const esEnlaceComercialVal = 
        c.esEnlaceComercial !== undefined ? c.esEnlaceComercial : 
        c.esenlacecomercial !== undefined ? c.esenlacecomercial : 
        c.es_enlace_comercial !== undefined ? c.es_enlace_comercial : false;

      return {
        id: c.id,
        nombre: c.nombre || '',
        puesto: c.puesto || '',
        cliente: c.cliente || '',
        planta: c.planta || '',
        email: c.email || '',
        telefono: c.telefono || '',
        esEnlaceComercial: !!esEnlaceComercialVal
      };
    });

    const auditLogs: AuditLog[] = audData || [];

    return {
      success: true,
      records,
      contacts,
      auditLogs,
      message: `Descarga consolidada exitosa: ${records.length} expedientes, ${contacts.length} contactos y ${auditLogs.length} logs sincronizados.`
    };

  } catch (error: any) {
    return {
      success: false,
      records: [],
      contacts: [],
      auditLogs: [],
      message: `Error al importar datos de Supabase: ${error.message}`
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
    // Format payload matching schema and apply strict math formulas for 16% VAT
    const hardware = Number(record.total_hardware_cotizacion) || 0;
    const servicios = Number(record.total_servicios_cotizacion) || 0;
    const subtotal = hardware + servicios;
    const iva = parseFloat((subtotal * 0.16).toFixed(2));
    const general = parseFloat((subtotal + iva).toFixed(2));

    const payload = {
      id: record.id,
      informacion_general_folio: record.informacion_general_folio,
      fecha_registro: record.fecha_registro,
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

    const { error } = await client
      .from('crm_records')
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
      .from('crm_records')
      .delete()
      .eq('id', recordId);

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
    const payload = {
      id: contact.id,
      nombre: contact.nombre,
      puesto: contact.puesto,
      cliente: contact.cliente,
      planta: contact.planta,
      email: contact.email,
      telefono: contact.telefono,
      esEnlaceComercial: contact.esEnlaceComercial
    };

    const { error } = await client
      .from('contacts')
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
      .from('contacts')
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
    const { error } = await client
      .from('audit_logs')
      .upsert({
        id: log.id,
        fecha: log.fecha,
        accion: log.accion,
        operador: log.operador,
        perfil: log.perfil,
        detalles: log.detalles
      }, { onConflict: 'id' });

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
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(url, key);
  if (!client) return { success: false, message: 'Cliente Supabase no configurado.' };

  try {
    let recCount = 0;
    let conCount = 0;
    let audCount = 0;

    // Upload records sequentially or concurrently in small batches
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
      message: `Exportación consolidada exitosa. Se subieron ${recCount}/${records.length} expedientes, ${conCount}/${contacts.length} contactos y ${audCount}/${auditLogs.length} logs.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error al realizar carga masiva: ${error.message}`
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

-- Limpiar políticas viejas si ya existen para evitar errores al re-ejecutar
drop policy if exists "Permiso lectura libre" on crm_records;
drop policy if exists "Permiso escritura libre" on crm_records;
drop policy if exists "Permiso edicion libre" on crm_records;
drop policy if exists "Permiso borrado libre" on crm_records;

create policy "Permiso lectura libre" on crm_records for select using (true);
create policy "Permiso escritura libre" on crm_records for insert with check (true);
create policy "Permiso edicion libre" on crm_records for update using (true);
create policy "Permiso borrado libre" on crm_records for delete using (true);

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
