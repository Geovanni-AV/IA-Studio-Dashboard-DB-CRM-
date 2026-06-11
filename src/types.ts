export type UserRole = 'Admin' | 'Vendedor' | 'Solo Lectura';

export interface FollowupEntry {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: 'Llamada Telefónica' | 'Correo Electrónico' | 'Revisión Técnica' | 'Visita a Sitio' | 'Minuta de Junta';
  creador: string; // e.g., Laura (Ventas)
  notas: string;
}

export interface CRMRecord {
  id: string;
  informacion_general_folio: string; // e.g. "VT-1553"
  fecha_registro: string; // YYYY-MM-DD
  informacion_general_cliente: string; // Grupo Bimbo, AstraZeneca, UNAM, etc.
  informacion_general_planta: string; // Planta Toluca, Planta Monterrey, etc.
  cliente_pais: string; // México, EE.UU., LATAM
  cliente_ubicacion: string; // Specific city/state (e.g. CDMX, Monterrey, New York)
  informacion_general_proyecto: string; // e.g., "Medición de Flujo Vapor"
  informacion_general_link_cotizacion: string; // Google Drive PDF link
  total_hardware_cotizacion: number; // Supplies
  total_servicios_cotizacion: number; // Support/Installation SERVICES
  total_subtotal_cotizacion: number; // Hardware + Services
  total_iva_cotizacion: number; // 16% of Subtotal
  total_general_cotizacion: number; // Subtotal + IVA
  informacion_general_moneda: 'USD' | 'MXN'; // Contract default currency
  status_proyecto: 'Propuesta' | 'Negociación' | 'Cerrado Ganado';
  
  // Purchase Order Details (for Cerrado Ganado)
  folio_orden_compra?: string;
  link_orden_compra?: string;
  fecha_inicio_proyecto?: string; // YYYY-MM-DD
  informacion_general_instalacion_incluida?: boolean;
  
  notas_comerciales: string;
  acciones_seguimiento: FollowupEntry[];
  
  // Custom tracking for Obsolete or substituted ref
  sustituye_folio_anterior?: string; // Trazabilidad
  prioridad_nivel?: 'Win' | 'Hot' | 'Warm' | 'Cool';
}

export interface AuditLog {
  id: string;
  fecha: string; // YYYY-MM-DD HH:mm:ss
  accion: 'ALTA REGISTRO' | 'MODIFICACIÓN' | 'ELIMINACIÓN' | 'RESTABLECIMIENTO' | 'CONEXIÓN HOJA';
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
}
