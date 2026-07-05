/**
 * Redondeo financiero seguro para evitar errores de punto flotante en JS.
 * Ej: safeRound(10.555) -> 10.56
 */
export const safeRound = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Intenta convertir un JSON de Supabase. Si detecta que es texto plano heredado,
 * lo formatea de manera segura sin romper la aplicación.
 */
export const safeJsonParse = <T,>(jsonString: string | null | undefined, fallback: T, fieldName: string): T => {
  if (!jsonString) return fallback;
  
  const trimmed = jsonString.trim();
  
  // 1. Escudo Anti-Texto Plano: Si no empieza con '[' (Arreglo) o '{' (Objeto), es texto plano.
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    // Si buscábamos un arreglo (ej. tags), envolvemos el texto en uno para no romper el .map()
    if (Array.isArray(fallback)) {
      return [trimmed] as unknown as T;
    }
    return trimmed as unknown as T;
  }

  // 2. Parseo estándar
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    console.warn(`⚠️ [Autocorrección] El campo '${fieldName}' contenía JSON inválido. Usando valor por defecto.`);
    return fallback;
  }
};
