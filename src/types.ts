export type UserRole = 'Admin' | 'Vendedor' | 'Solo Lectura';

export interface UserAccount {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  estado: 'active' | 'pending' | 'rejected';
  created_at: string;
}

export interface FollowupEntry {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: 'Llamada Telefónica' | 'Correo Electrónico' | 'Revisión Técnica' | 'Visita a Sitio' | 'Minuta de Junta';
  creador: string; // e.g., Laura (Ventas)
  notas: string;
}

export interface CRMRecord {
  id: string;
  informacion_general_folio: string | null; // e.g. "VT-1553"
  fecha_registro: string | null; // YYYY-MM-DD
  informacion_general_cliente: string | null; // Grupo Bimbo, AstraZeneca, UNAM, etc.
  informacion_general_planta: string | null; // Planta Toluca, Planta Monterrey, etc.
  cliente_pais: string | null; // México, EE.UU., LATAM
  cliente_ubicacion: string | null; // Specific city/state (e.g. CDMX, Monterrey, New York)
  informacion_general_proyecto: string | null; // e.g., "Medición de Flujo Vapor"
  informacion_general_link_cotizacion: string | null; // Google Drive PDF link
  total_hardware_cotizacion: number | null; // Supplies
  total_servicios_cotizacion: number | null; // Support/Installation SERVICES
  total_subtotal_cotizacion: number | null; // Hardware + Services
  total_iva_cotizacion: number | null; // 16% of Subtotal
  total_general_cotizacion: number | null; // Subtotal + IVA
  informacion_general_moneda: 'USD' | 'MXN'; // Contract default currency
  estado_proyecto?: 'Propuesta' | 'Negociación' | 'Cerrado Ganado' | 'Cerrado Perdido' | null; // Column 6
  status_proyecto?: 'Win' | 'Hot' | 'Warm' | 'Cool' | null; // Column 7
  
  // Purchase Order Details (for Cerrado Ganado)
  folio_orden_compra?: string | null;
  link_orden_compra?: string | null;
  fecha_inicio_proyecto?: string | null; // YYYY-MM-DD
  informacion_general_instalacion_incluida?: boolean;
  
  notas_comerciales: string | null;
  acciones_seguimiento: FollowupEntry[];
  
  // Custom tracking for Obsolete or substituted ref
  sustituye_folio_anterior?: string | null; // Trazabilidad
  prioridad_nivel?: 'Win' | 'Hot' | 'Warm' | 'Cool' | null;
  
  // Campos independientes solicitados para el Kanban
  etapa?: string | null;
  nivel_termo?: string | null;
  prioridad?: number | null;
  estado?: string | null;
  
  // Nuevos campos para persistencia en Supabase
  fecha_cambio_etapa?: string | null;
  stagnation_days_limit?: number | null;
  checklist_tasks?: string | null;
  __tareas?: { id: string; text: string; completed: boolean }[] | null;
  contacto_asignado_id?: string | null;
  responsable?: string | null;
  tags?: string | null;
  
  // Campos de contacto asignado
  contacto_nombre?: string | null;
  contacto_puesto?: string | null;
  contacto_email?: string | null;
  contacto_telefono?: string | null;
}

export interface AuditLog {
  id: string;
  fecha: string; // YYYY-MM-DD HH:mm:ss
  accion: 'ALTA REGISTRO' | 'MODIFICACIÓN' | 'ELIMINACIÓN' | 'RESTABLECIMIENTO' | 'CONEXIÓN HOJA' | 'INICIO SESIÓN' | 'CERRAR SESIÓN' | 'ERROR' | 'ANOMALÍA' | 'CÓMPUTO' | 'CONSULTA';
  operador: string; // geovanni@verse-technology.com
  perfil: UserRole;
  detalles: string;
}

export interface Contact {
  id: string;
  nombre: string;
  puesto: string;
  cliente: string; // Bimbo, AstraZeneca, UNAM, etc.
  planta: string;
  email: string;
  telefono: string;
  esEnlaceComercial: boolean; // Previene pérdidas y optimiza respuestas
  
  // Campos de localización, tipo y organización para la tabla "contactos" en Supabase
  tipo?: string;
  organizacion?: string;
  prefijoSufijo?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  direccion?: string;
  nombreUbicacion?: string;
  empresa?: string;
}

export interface OCItemPartida {
  ID_Linea: string;
  Numero_Linea: number;
  Clave_Articulo_Proveedor: string;
  Descripcion_Articulo: string;
  Descripcion_Producto?: string;
  Unidad_Medida: string;
  Cantidad: number;
  Cantidad_Ordenada?: number;
  Precio_Unitario: number;
  Importe_Linea: number;
  Importe_Total_Linea?: number;
  Estado_Linea?: string;
  Fecha_Requerida?: string;
  Fecha_Prometida?: string;
  Fecha_Solicitada?: string;
  ID_Documento?: string;
  Tasa_Impuesto?: string;
  Monto_Cancelado?: number;
}

export interface PurchaseOrder {
  id: string;
  folioOC: string;           // ← id_documento en DB
  linkOC: string;            // ← link_pdf en DB
  fechaInicio: string;       // ← fecha_expedicion en DB
  instalacionIncluida: boolean;
  monto: number;             // ← parseFloat(importe_total_documento) en DB
  moneda: 'USD' | 'MXN';
  cliente: string;           // ← empresa_compradora en DB
  proyecto: string;          // ← area_proyecto en DB
  folioRefCRM: string;       // ← _system_fileid o id_documento en DB
  estatusPago: string;
  replacedById?: number | null;
  leadId?: string | null;
  __partidas?: OCItemPartida[] | null;
  // Campos extendidos del esquema real
  nombreArchivo?: string;
  tipoDocumento?: string;
  empresaProveedora?: string;
  contactoComprador?: string;
  terminosPago?: string;
  lugarEntrega?: string;
  versionChangeOrder?: string;
  numeroCambioOrden?: string;
  estadoDocumento?: string;
  
  // Compatibilidad con prefijos
  _nombreArchivo?: string;
  _tipoDocumento?: string;
  _empresaProveedora?: string;
  _contactoComprador?: string;
  _terminosPago?: string;
  _lugarEntrega?: string;
}

export interface ColumnConfig {
  name: string;
  require_confirm: boolean;
}
