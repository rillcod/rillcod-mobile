import { Share } from 'react-native';

function escapeCell(value: unknown): string {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

/** RFC-style CSV rows (no header row unless you pass one). */
export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

/** Share CSV text via the system sheet (no extra native deps). */
export async function shareCsv(title: string, rows: string[][]): Promise<void> {
  const body = rowsToCsv(rows);
  await Share.share({ title, message: body });
}
