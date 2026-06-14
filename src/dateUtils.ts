/**
 * Mexico City Timezone (America/Mexico_City) DateTime Helper Utilities
 */

interface DateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

export function getMexicoCityParts(dateInput: Date | number = new Date()): DateTimeParts {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const partMap = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  const hourValue = partMap.hour;
  // Handle some old runtimes outputting '24' instead of '00' for midnights
  const hour = hourValue === '24' ? '00' : hourValue;

  return {
    year: partMap.year || '2026',
    month: partMap.month || '01',
    day: partMap.day || '01',
    hour: hour || '00',
    minute: partMap.minute || '00',
    second: partMap.second || '00',
  };
}

/**
 * Returns a date-time string in format: YYYY-MM-DD HH:mm:ss
 */
export function getMexicoCityDateTimeString(dateInput: Date | number = new Date()): string {
  const { year, month, day, hour, minute, second } = getMexicoCityParts(dateInput);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Returns a date-time string in format: YYYY-MM-DD HH:mm
 */
export function getMexicoCityDateTimeShortString(dateInput: Date | number = new Date()): string {
  const { year, month, day, hour, minute } = getMexicoCityParts(dateInput);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * Returns a date string in format: YYYY-MM-DD
 */
export function getMexicoCityDateString(dateInput: Date | number = new Date()): string {
  const { year, month, day } = getMexicoCityParts(dateInput);
  return `${year}-${month}-${day}`;
}

/**
 * Returns a time string in format: HH:mm:ss
 */
export function getMexicoCityTimeString(dateInput: Date | number = new Date()): string {
  const { hour, minute, second } = getMexicoCityParts(dateInput);
  return `${hour}:${minute}:${second}`;
}
