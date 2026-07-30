// Minimal JSON-stat 2.0 reader (port from WF-mapping-main/lib/jsonstat.js).
// Used by the Eurostat connector to parse SDMX / JSON-stat API responses.

export interface JsonStatPayload {
  id?: string[];
  size?: number[];
  dimension?: Record<string, {
    category?: {
      index?: Record<string, number> | string[];
    };
  }>;
  value?: Record<string, number | null>;
}

export interface JsonStatRow {
  value: number;
  [dim: string]: string | number;
}

export function* iterJsonStat(payload: JsonStatPayload): Iterable<JsonStatRow> {
  if (!payload?.id || !payload?.size) return;

  const dimNames = payload.id;
  const sizes = payload.size;
  const dimIndices: string[][] = dimNames.map((name) => {
    const cat = payload.dimension?.[name]?.category;
    if (!cat) return [];
    if (Array.isArray(cat.index)) return cat.index as string[];
    return Object.entries(cat.index as Record<string, number>)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);
  });

  const total = sizes.reduce((a, b) => a * b, 1);
  const values = payload.value ?? {};

  for (let i = 0; i < total; i++) {
    const v = values[i];
    if (v == null) continue;
    let rem = i;
    const row: JsonStatRow = { value: Number(v) };
    for (let d = sizes.length - 1; d >= 0; d--) {
      const dimSize = sizes[d];
      const pos = rem % dimSize;
      rem = Math.floor(rem / dimSize);
      row[dimNames[d]] = dimIndices[d][pos];
    }
    yield row;
  }
}
