import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';

const ALLOWED_TABLES = new Set([
  'users','admins','agents','agent_capabilities',
  'listings','direct_messages','messages','notifications',
  'credits','transactions','leaderboard','roles',
  'businesses','business_members','treasury',
  'jobs','job_bids','game_tables','game_players','game_rounds',
  'pulses','validations','follows','skill_listings',
  'credit_tips','credit_cashouts','support_messages',
  'land_plots','plot_buildings','user_bans',
  'agent_external_api_keys',
]);


const INVALID_NAME_PATTERNS = /^(placeholder|test|default|unnamed|null|guest|n\/?a|agent)$/i;

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function validateAgentName(name) {
  const normalized = normalizeName(name);
  if (!normalized || normalized.length < 3) {
    throw Object.assign(new Error('Agent name must be at least 3 characters.'), { status: 400 });
  }
  if (INVALID_NAME_PATTERNS.test(normalized)) {
    throw Object.assign(new Error('Please choose a real, descriptive agent name.'), { status: 400 });
  }
  return normalized;
}

// SECURITY: only allow safe column name characters to prevent SQL injection
function safeCol(col) {
  if (!/^[a-zA-Z0-9_]+$/.test(col)) {
    throw Object.assign(new Error(`Invalid column name: ${col}`), { status: 400 });
  }
  return col;
}

function splitTopLevel(str) {
  const parts = []; let depth = 0; let buf = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; } else buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
}

function parseColumns(cols) {
  if (!cols || cols === '*') return { select: '*', joins: [] };
  const parts = splitTopLevel(cols);
  const selectParts = []; const joins = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (part.includes('(')) {
      const m = part.match(/^(?:(\w+):)?([^!(,]+)(?:!([^(]+))?\((.+)\)$/);
      if (m) joins.push({ alias: m[1]||m[2].trim(), table: m[2].trim(), fkeyHint: m[3]?m[3].trim():null, columns: m[4].trim() });
    } else {
      selectParts.push(part);
    }
  }
  return { select: selectParts.length ? selectParts.join(', ') : '*', joins };
}

function resolveFkeyHint(hint, parentTable) {
  if (!hint) return null;
  const base = hint.replace(/_fkey$/, '');
  const prefix = `${parentTable}_`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : null;
}

async function resolveJoin(parentRows, join, parentTable) {
  if (!parentRows.length) return;
  const { alias, table, fkeyHint, columns } = join;
  const selectCols = (!columns || columns === '*') ? '*' : columns;
  if (!ALLOWED_TABLES.has(table)) { parentRows.forEach(r => { r[alias] = null; }); return; }
  const localCol = resolveFkeyHint(fkeyHint, parentTable);
  if (localCol) {
    const ids = [...new Set(parentRows.map(r => r[localCol]).filter(Boolean))];
    if (!ids.length) { parentRows.forEach(r => { r[alias] = null; }); return; }
    const ph = ids.map(() => '?').join(',');
    const [rows] = await pool.query(`SELECT ${selectCols} FROM \`${table}\` WHERE id IN (${ph})`, ids);
    const map = new Map(rows.map(r => [r.id, r]));
    parentRows.forEach(r => { r[alias] = map.get(r[localCol]) ?? null; });
  } else {
    const parentIds = [...new Set(parentRows.map(r => r.id).filter(Boolean))];
    if (!parentIds.length) { parentRows.forEach(r => { r[alias] = []; }); return; }
    const singular = parentTable.replace(/s$/, '');
    const candidates = [`${singular}_id`, `${parentTable}_id`];
    const ph = parentIds.map(() => '?').join(',');
    let rows = []; let usedFk = null;
    for (const fk of candidates) {
      try {
        const [r] = await pool.query(`SELECT ${selectCols} FROM \`${table}\` WHERE \`${fk}\` IN (${ph})`, parentIds);
        rows = r; usedFk = fk; break;
      } catch { /* try next */ }
    }
    if (usedFk) {
      const grouped = new Map();
      for (const row of rows) {
        const key = row[usedFk];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
      }
      parentRows.forEach(r => { r[alias] = grouped.get(r.id) ?? []; });
    } else {
      parentRows.forEach(r => { r[alias] = []; });
    }
  }
}

function parseOrFilter(orValue) {
  const clauses = []; const params = [];
  for (const part of splitTopLevel(orValue)) {
    const trimmed = part.trim();
    const andMatch = trimmed.match(/^and\((.+)\)$/);
    if (andMatch) {
      const andClauses = [];
      for (const ip of splitTopLevel(andMatch[1])) {
        const [col, op, ...v] = ip.trim().split('.');
        if (op === 'eq') { andClauses.push(`\`${safeCol(col)}\` = ?`); params.push(v.join('.')); }
      }
      if (andClauses.length) clauses.push(`(${andClauses.join(' AND ')})`);
    } else {
      const d1 = trimmed.indexOf('.'); const col = trimmed.slice(0,d1); const rest = trimmed.slice(d1+1);
      const d2 = rest.indexOf('.'); const op = rest.slice(0,d2); const val = rest.slice(d2+1);
      if (op === 'eq') { clauses.push(`\`${safeCol(col)}\` = ?`); params.push(val); }
    }
  }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : null, params };
}

export async function runTableQuery({ table, action, values, filters=[], order=[], limit, columns='*', options={}, single, returning=false, returningColumns='*' }) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);

  if (action === 'select') {
    const { select, joins } = parseColumns(columns);
    let sql = `SELECT ${select} FROM \`${table}\``;
    const params = []; const where = [];
    for (const f of filters) {
      if (f.op === 'eq') { where.push(`\`${safeCol(f.column)}\` = ?`); params.push(f.value); }
      else if (f.op === 'in' && Array.isArray(f.value) && f.value.length) {
        where.push(`\`${safeCol(f.column)}\` IN (${f.value.map(()=>'?').join(',')})`); params.push(...f.value);
      } else if (f.op === 'or' && f.value) {
        const { sql: orSql, params: orP } = parseOrFilter(f.value);
        if (orSql) { where.push(orSql); params.push(...orP); }
      } else if (f.op === 'is' && f.value === null) {
        where.push(`\`${safeCol(f.column)}\` IS NULL`);
      }
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    if (order.length) sql += ` ORDER BY ${order.map(o=>`\`${safeCol(o.column)}\` ${o.options?.ascending===false?'DESC':'ASC'}`).join(', ')}`;
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    const [rows] = await pool.query(sql, params);
    const shouldCount = options?.count === 'exact';
    let count = null;
    if (shouldCount) {
      let countSql = `SELECT COUNT(*) AS total FROM \`${table}\``;
      if (where.length) countSql += ` WHERE ${where.join(' AND ')}`;
      const [[countRow]] = await pool.query(countSql, params);
      count = Number(countRow?.total || 0);
    }
    for (const join of joins) await resolveJoin(rows, join, table);
    return { data: single ? (rows[0]??null) : rows, count };
  }

  if (action === 'insert') {
    const items = Array.isArray(values) ? values : [values];
    const inserted = [];
    for (const raw of items) {
      const payload = { ...(raw || {}) };
      if (table === 'agents') payload.name = validateAgentName(payload.name);
      if (!payload.id) payload.id = uuidv4();
      const fields = Object.keys(payload);
      await pool.query(
        `INSERT INTO \`${table}\` (${fields.map(f=>`\`${safeCol(f)}\``).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,
        fields.map(f => payload[f])
      );
      inserted.push(payload);
    }
    if (!returning) return { data: Array.isArray(values) ? inserted : inserted[0] };
    const idList = inserted.map((row) => row.id).filter(Boolean);
    if (!idList.length) return { data: Array.isArray(values) ? inserted : inserted[0] };
    const [rows] = await pool.query(
      `SELECT ${returningColumns || '*'} FROM \`${table}\` WHERE id IN (${idList.map(() => '?').join(',')})`,
      idList
    );
    const map = new Map(rows.map((row) => [row.id, row]));
    const returned = inserted.map((row) => map.get(row.id) || row);
    return { data: single ? (returned[0] || null) : (Array.isArray(values) ? returned : returned[0]) };
  }

  if (action === 'update') {
    const payload = { ...values };
    if (table === 'agents' && Object.prototype.hasOwnProperty.call(payload, 'name')) payload.name = validateAgentName(payload.name);
    const fields = Object.keys(payload);
    const params = fields.map(f => payload[f]);
    let sql = `UPDATE \`${table}\` SET ${fields.map(f=>`\`${safeCol(f)}\` = ?`).join(', ')}`;
    const eqf = filters.filter(f=>f.op==='eq');
    if (eqf.length) { sql += ` WHERE ${eqf.map(f=>`\`${safeCol(f.column)}\` = ?`).join(' AND ')}`; params.push(...eqf.map(f=>f.value)); }
    const [result] = await pool.query(sql, params);
    if (!returning) return { data: result };
    if (!eqf.length) return { data: single ? null : [] };
    const where = eqf.map(f=>`\`${safeCol(f.column)}\` = ?`).join(' AND ');
    const [rows] = await pool.query(`SELECT ${returningColumns || '*'} FROM \`${table}\` WHERE ${where}`, eqf.map(f=>f.value));
    return { data: single ? (rows[0] || null) : rows };
  }

  if (action === 'delete') {
    const params = []; let sql = `DELETE FROM \`${table}\``;
    const eqf = filters.filter(f=>f.op==='eq');
    if (eqf.length) { sql += ` WHERE ${eqf.map(f=>`\`${safeCol(f.column)}\` = ?`).join(' AND ')}`; params.push(...eqf.map(f=>f.value)); }
    const [result] = await pool.query(sql, params);
    return { data: result };
  }

  throw new Error(`Unsupported action: ${action}`);
}
