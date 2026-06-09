/**
 * Case transform utilities for API responses.
 * The admin frontend reads snake_case, so all responses must be snake_case.
 */

export function snakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;

  const record = obj as Record<string, unknown>;
  return Object.keys(record).reduce<Record<string, unknown>>((acc, key) => {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, char: string) => char >= 'a' ? char.toUpperCase() : char);
    acc[camelKey] = snakeToCamel(record[key]);
    return acc;
  }, {});
}

/**
 * Recursively convert camelCase keys to snake_case.
 * Applied to all API responses so frontend gets consistent snake_case.
 */
export function camelToSnake(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;

  const record = obj as Record<string, unknown>;
  return Object.keys(record).reduce<Record<string, unknown>>((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase());
    acc[snakeKey] = camelToSnake(record[key]);
    return acc;
  }, {});
}
