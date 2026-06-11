import { CRMRecord, Contact, AuditLog } from './types';

export const INITIAL_RECORDS: CRMRecord[] = [
  {
    id: "rec_1",
    informacion_general_folio: "VT-1553",
    fecha_registro: "2023-10-15",
    informacion_general_cliente: "Grupo Bimbo",
    informacion_general_planta: "Planta Toluca",
    cliente_pais: "México",
    cliente_ubicacion: "EdoMex",
    informacion_general_proyecto: "Monitoreo de Eficiencia en Hornos (Medición de Flujo)",
    informacion_general_link_cotizacion: "https://drive.google.com/file/d/official_quote_bimbo_v1",
    total_hardware_cotizacion: 15200,
    total_servicios_cotizacion: 4800,
    total_subtotal_cotizacion: 20000,
    total_iva_cotizacion: 3200,
    total_general_cotizacion: 23200,
    informacion_general_moneda: "USD",
    status_proyecto: "Negociación",
    notas_comerciales: "Bimbo requiere alta precisión en medidores de flujo Coriolis. Tolerancia del presupuesto ajustada a las fluctuaciones del tipo de cambio del USD en México.",
    acciones_seguimiento: [
      {
        id: "follow_1_1",
        fecha: "2023-10-25 14:30",
        tipo: "Correo Electrónico",
        creador: "Laura (Ventas)",
        notas: "Envío de Propuesta Preliminar v1. Se adjuntó propuesta técnica preliminar con desglose de medidores físicos y servicios técnicos de montaje de flujos."
      },
      {
        id: "follow_1_2",
        fecha: "2023-10-31 16:45",
        tipo: "Llamada Telefónica",
        creador: "Laura (Ventas)",
        notas: "Conversación con el director de finanzas del corporativo sobre la tasa cambiaria del USD. Acordamos conservar una tasa fija temporal de 17.05 pesos por USD."
      },
      {
        id: "follow_1_3",
        fecha: "2023-11-02 09:15",
        tipo: "Revisión Técnica",
        creador: "Ing. Ricardo S. (Técnico)",
        notas: "Revisión Técnica - Planta Norte. Se validó físicamente espacio para sensores en hornos. Solicitan incremento de 15% en el flujo de instrumentación debido a nuevo quemador."
      }
    ]
  },
  {
    id: "rec_2",
    informacion_general_folio: "VT-1554",
    fecha_registro: "2023-10-18",
    informacion_general_cliente: "AstraZeneca",
    informacion_general_planta: "Planta Guadalajara",
    cliente_pais: "México",
    cliente_ubicacion: "Jalisco",
    informacion_general_proyecto: "Calibración de Flujo de Vapor en Línea Principal",
    informacion_general_link_cotizacion: "https://drive.google.com/file/d/official_quote_astra_v3",
    total_hardware_cotizacion: 8500,
    total_servicios_cotizacion: 3500,
    total_subtotal_cotizacion: 12000,
    total_iva_cotizacion: 1920,
    total_general_cotizacion: 13920,
    informacion_general_moneda: "USD",
    status_proyecto: "Propuesta",
    notas_comerciales: "Requisito crítico de calibración en sitio bajo normativa farmacéutica Cofepris.",
    acciones_seguimiento: [
      {
        id: "follow_2_1",
        fecha: "2023-10-20 11:15",
        tipo: "Llamada Telefónica",
        creador: "Laura (Ventas)",
        notas: "Primer contacto comercial con el Jefe de Ingeniería Médica en Planta Guadalajara. Solicita cotizar calibración bajo certificado trazable."
      }
    ]
  },
  {
    id: "rec_3",
    informacion_general_folio: "VT-1558",
    fecha_registro: "2023-10-10",
    informacion_general_cliente: "UNAM",
    informacion_general_planta: "Centro de Investigación CDMX",
    cliente_pais: "México",
    cliente_ubicacion: "CDMX",
    informacion_general_proyecto: "Instrumentación de Medidores de Consumo Eléctrico Centralizado",
    informacion_general_link_cotizacion: "https://drive.google.com/file/d/official_quote_unam_v8",
    total_hardware_cotizacion: 210000,
    total_servicios_cotizacion: 90000,
    total_subtotal_cotizacion: 300000,
    total_iva_cotizacion: 48000,
    total_general_cotizacion: 348000,
    informacion_general_moneda: "MXN",
    status_proyecto: "Cerrado Ganado",
    folio_orden_compra: "OC-2023-9912",
    link_orden_compra: "https://drive.google.com/file/d/unam_purchase_order_9912_signed",
    fecha_inicio_proyecto: "2023-11-15",
    informacion_general_instalacion_incluida: true,
    notas_comerciales: "Adjudicación directa bajo presupuesto institucional en moneda nacional (MXN). Entrega programada antes del cierre fiscal nacional.",
    acciones_seguimiento: [
      {
        id: "follow_3_1",
        fecha: "2023-10-12 10:00",
        tipo: "Minuta de Junta",
        creador: "Laura (Ventas)",
        notas: "Firma de minuta técnica de acuerdo para cotización nacional."
      },
      {
        id: "follow_3_2",
        fecha: "2023-10-22 13:00",
        tipo: "Correo Electrónico",
        creador: "Laura (Ventas)",
        notas: "Notificación de recibimiento de la orden de compra OC-2023-9912 firmada por el patronato de la UNAM. Proyecto pasa oficialmente a logística."
      }
    ]
  },
  {
    id: "rec_4",
    informacion_general_folio: "VT-1510",
    fecha_registro: "2023-09-05",
    informacion_general_cliente: "Cervecería Modelo",
    informacion_general_planta: "Planta Zacatecas",
    cliente_pais: "México",
    cliente_ubicacion: "Zacatecas",
    informacion_general_proyecto: "Medición Integrada de CO2 en Envasado",
    informacion_general_link_cotizacion: "https://drive.google.com/file/d/official_quote_modelo_7782",
    total_hardware_cotizacion: 45000,
    total_servicios_cotizacion: 15000,
    total_subtotal_cotizacion: 60000,
    total_iva_cotizacion: 9600,
    total_general_cotizacion: 69600,
    informacion_general_moneda: "USD",
    status_proyecto: "Cerrado Ganado",
    folio_orden_compra: "PO-77341-Z",
    link_orden_compra: "https://drive.google.com/file/d/modelo_po_77341_verified",
    fecha_inicio_proyecto: "2023-12-01",
    informacion_general_instalacion_incluida: true,
    notas_comerciales: "Garantía extendida a 3 años para los controladores volumétricos redundantes.",
    acciones_seguimiento: [
      {
        id: "follow_4_1",
        fecha: "2023-09-20 16:00",
        tipo: "Visita a Sitio",
        creador: "Ing. Ricardo S. (Técnico)",
        notas: "Pruebas de calibración volumétrica exitosas. Se firmó la minuta de entrega y paso a producción."
      }
    ]
  },
  {
    id: "rec_5",
    informacion_general_folio: "VT-1562",
    fecha_registro: "2023-11-01",
    informacion_general_cliente: "General Motors",
    informacion_general_planta: "Planta Silao",
    cliente_pais: "EE.UU.",
    cliente_ubicacion: "Guanajuato",
    informacion_general_proyecto: "Redundancia en Monitoreo Eléctrico y Distribución",
    informacion_general_link_cotizacion: "https://drive.google.com/file/d/official_quote_gm_v4",
    total_hardware_cotizacion: 68000,
    total_servicios_cotizacion: 12000,
    total_subtotal_cotizacion: 80000,
    total_iva_cotizacion: 12800,
    total_general_cotizacion: 92800,
    informacion_general_moneda: "USD",
    status_proyecto: "Negociación",
    notas_comerciales: "Vínculo con corporativo de Detroit. Facturación y aprobación B2B a través de portal internacional.",
    acciones_seguimiento: [
      {
        id: "follow_5_1",
        fecha: "2023-11-05 10:30",
        tipo: "Correo Electrónico",
        creador: "Laura (Ventas)",
        notas: "Envío de folios e Incoterms DDP solicitados por el gestor de aduanas de GM."
      }
    ]
  }
];

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: "con_1",
    nombre: "Ing. Mónica del Valle",
    puesto: "Directora de Adquisiciones",
    cliente: "Grupo Bimbo",
    planta: "Planta Toluca",
    email: "monica.delvalle@bimbo.com",
    telefono: "+52 722 612 3456",
    esEnlaceComercial: true
  },
  {
    id: "con_2",
    nombre: "Dr. Alberto Juárez",
    puesto: "Líder de Instrumentación Biomédica",
    cliente: "AstraZeneca",
    planta: "Planta Guadalajara",
    email: "alberto.juarez@astrazeneca.com",
    telefono: "+52 331 423 9901",
    esEnlaceComercial: false
  },
  {
    id: "con_3",
    nombre: "Mtro. Federico de la Cruz",
    puesto: "Coordinador de Infraestructura Teórica",
    cliente: "UNAM",
    planta: "Centro de Investigación CDMX",
    email: "fdelacruz@unam.mx",
    telefono: "+52 555 622 1705",
    esEnlaceComercial: true
  },
  {
    id: "con_4",
    nombre: "Ing. Diana Rosas",
    puesto: "Supervisora de Instrumentación Eléctrica",
    cliente: "General Motors",
    planta: "Planta Silao",
    email: "diana.rosas@gm.com",
    telefono: "+52 472 101 2288",
    esEnlaceComercial: true
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: "aud_1",
    fecha: "2026-06-10 10:15:30",
    accion: "RESTABLECIMIENTO",
    operador: "geovanni@verse-technology.com",
    perfil: "Admin",
    detalles: "Base de datos local restablecida con éxito al estado estándar de pruebas (Bimbo, AstraZeneca y UNAM)."
  },
  {
    id: "aud_2",
    fecha: "2026-06-10 12:44:11",
    accion: "ALTA REGISTRO",
    operador: "geovanni@verse-technology.com",
    perfil: "Admin",
    detalles: "Se registró nueva oportunidad comercial y de instrumentación con folio VT-1562 (General Motors)."
  }
];
