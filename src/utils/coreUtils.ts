/**
 * Redondeo financiero seguro para evitar errores de punto flotante en JS.
 * Ej: safeRound(10.555) -> 10.56
 */
export const safeRound = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Intenta convertir un JSON. Si falla, reporta el error y devuelve un valor por defecto
 * para evitar que la aplicación entera colapse.
 */
export const safeJsonParse = <T,>(jsonString: string | null | undefined, fallback: T, fieldName: string): T => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error(`🚨 [Integridad de Datos] Error al leer el campo JSON '${fieldName}':`, error);
    return fallback;
  }
};
