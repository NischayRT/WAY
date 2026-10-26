/**
 * Shared helpers for the CSV → SQL generators in this folder.
 *
 * The SQL they print is pasted into the Supabase SQL editor, which runs with
 * full rights, so every cell must become exactly one safe SQL literal:
 * text is quoted and escaped, numbers must look like numbers, and quoted CSV
 * cells ("Ragi (finger millet, raw)") stay one cell.
 */

/** Split one CSV line, honouring "quoted, cells" and "" escapes. */
function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (inQuotes) throw new Error('Unclosed quote');
  cells.push(current.trim());
  return cells;
}

/** Rows of { header: cell } objects, with the CSV line number for errors. */
function readCsv(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  return lines
    .slice(1)
    .map((line, i) => ({ line, n: i + 2 }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, n }) => {
      let cells;
      try {
        cells = parseCsvLine(line);
      } catch (e) {
        throw new Error(`Line ${n}: ${e.message}`);
      }
      const row = Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? '']));
      row.__line = n;
      return row;
    });
}

/** Quoted SQL text, or null for an empty cell. */
function text(val) {
  if (val === '' || val === undefined || val === null) return 'null';
  return `'${String(val).replace(/'/g, "''")}'`;
}

/** A plain decimal number, or null for an empty cell. Anything else is an error. */
function num(val, row, field) {
  if (val === '' || val === undefined || val === null) return 'null';
  if (!/^-?\d+(\.\d+)?$/.test(String(val))) {
    throw new Error(`Line ${row.__line}: ${field} must be a number, got ${JSON.stringify(val)}`);
  }
  return String(val);
}

/** A whole number (ids). Required. */
function int(val, row, field) {
  if (!/^\d+$/.test(String(val ?? ''))) {
    throw new Error(`Line ${row.__line}: ${field} must be a whole number, got ${JSON.stringify(val)}`);
  }
  return String(val);
}

/** Print the SQL, or the first bad cell and exit non-zero. */
function run(build) {
  try {
    console.log(build());
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { parseCsvLine, readCsv, text, num, int, run };
