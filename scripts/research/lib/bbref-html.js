// Minimal, dependency-free reader for Basketball-Reference tables.
// Basketball-Reference marks every cell with data-stat="..." and wraps some tables in
// HTML comments, so a small tolerant parser is enough; no DOM library is needed.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Returns the HTML of the table with the given id, looking inside HTML comments too. */
export function findTable(html, tableId) {
  const uncommented = html.replace(/<!--|-->/g, '');
  const start = uncommented.search(new RegExp(`<table[^>]*\\bid="${tableId}"`));
  if (start < 0) return null;
  const end = uncommented.indexOf('</table>', start);
  return uncommented.slice(start, end < 0 ? undefined : end);
}

/**
 * Parses body rows of a Basketball-Reference table into objects keyed by data-stat.
 * Each row also gets `$links` (data-stat -> first href) and `$ids` (data-stat -> data-append-csv).
 * Header and spacer rows are skipped.
 */
export function parseTable(html, tableId) {
  const table = findTable(html, tableId);
  if (!table) return [];
  const body = table.slice(Math.max(0, table.indexOf('<tbody')));
  const rows = [];
  for (const [, attrs, inner] of body.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
    if (/class="[^"]*\b(thead|spacer|over_header)\b/.test(attrs)) continue;
    const row = { $links: {}, $ids: {} };
    let cells = 0;
    for (const [, cellAttrs, cellHtml] of inner.matchAll(/<t[hd]([^>]*)>([\s\S]*?)<\/t[hd]>/g)) {
      const stat = cellAttrs.match(/data-stat="([^"]*)"/)?.[1];
      if (!stat) continue;
      cells += 1;
      row[stat] = stripTags(cellHtml);
      const href = cellHtml.match(/href="([^"]+)"/)?.[1];
      if (href) row.$links[stat] = href;
      const id = cellAttrs.match(/data-append-csv="([^"]+)"/)?.[1];
      if (id) row.$ids[stat] = id;
    }
    if (cells > 0) rows.push(row);
  }
  return rows;
}

/** Basketball-Reference player id from a /players/x/abcdeXX01.html link. */
export function playerIdFromHref(href) {
  return href?.match(/\/players\/[a-z]\/([a-z0-9]+)\.html/)?.[1] ?? null;
}

export function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
