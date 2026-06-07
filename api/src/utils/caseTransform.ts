/**
 * Snake-case to camelCase converter for DB response objects.
 * Applied at the API boundary so SQL stays snake_case but HTTP responses are camelCase.
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
