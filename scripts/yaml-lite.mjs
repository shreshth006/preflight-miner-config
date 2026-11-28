// yaml-lite.mjs — Minimal YAML parser for Telegraph miner manifests.
// Handles: scalars, sequences, mappings, block scalars (> and |), flow sequences,
// and comments. No external dependencies.
//
// This intentionally does NOT cover the full YAML spec.  It covers exactly the
// subset used by telegraph/miner.yaml so the validator can run with zero npm
// dependencies on any Node >= 18.

export function parse(text) {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return parseLines(lines, 0, -1).value;
}

function parseLines(lines, start, parentIndent) {
  const result = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines and comments
    if (/^\s*(#|$)/.test(line)) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break; // de-dented past our block

    // ── Sequence item (- value) ──────────────────────────────────────────
    if (/^\s*-\s/.test(line)) {
      // We're inside a sequence; parse it and return as an array
      const arr = [];
      const seqIndent = indent;
      while (i < lines.length) {
        const l = lines[i];
        if (/^\s*(#|$)/.test(l)) { i++; continue; }
        const li = l.search(/\S/);
        if (li < seqIndent) break;
        if (li === seqIndent && l.trimStart().startsWith('- ')) {
          const after = l.replace(/^\s*-\s*/, '');
          // Inline mapping after dash?
          if (/^\S.*:\s/.test(after) || /^\S.*:$/.test(after)) {
            // It's a mapping item inside the sequence
            const sub = parseMapping(lines, i, seqIndent);
            arr.push(sub.value);
            i = sub.next;
          } else {
            arr.push(castScalar(after));
            i++;
          }
        } else if (li > seqIndent) {
          // Continuation of previous item (mapping under -)
          const sub = parseLines(lines, i, seqIndent);
          if (arr.length > 0 && typeof arr[arr.length - 1] === 'object') {
            Object.assign(arr[arr.length - 1], sub.value);
          }
          i = sub.next;
        } else {
          break;
        }
      }
      return { value: arr, next: i };
    }

    // ── Key: value ───────────────────────────────────────────────────────
    const kvMatch = line.match(/^(\s*)([\w][\w.-]*)\s*:\s*(.*)/);
    if (!kvMatch) { i++; continue; }

    const key = kvMatch[2];
    let val = kvMatch[3].replace(/#.*$/, '').trim(); // strip inline comments

    if (val === '' || val === '>' || val === '|') {
      // Check what follows: block scalar, nested mapping, or sequence
      const nextNonEmpty = peekNextContent(lines, i + 1);
      if (nextNonEmpty !== null) {
        const nextIndent = lines[nextNonEmpty].search(/\S/);
        if (nextIndent > indent) {
          if (val === '>' || val === '|') {
            // Block scalar
            const bs = collectBlockScalar(lines, i + 1, indent, val === '>');
            result[key] = bs.text;
            i = bs.next;
            continue;
          }
          if (lines[nextNonEmpty].trimStart().startsWith('- ')) {
            const sub = parseLines(lines, nextNonEmpty, indent);
            result[key] = sub.value;
            i = sub.next;
            continue;
          }
          const sub = parseLines(lines, i + 1, indent);
          result[key] = sub.value;
          i = sub.next;
          continue;
        }
      }
      result[key] = val === '' ? null : '';
      i++;
      continue;
    }

    // Flow sequence: [a, b, c]
    if (val.startsWith('[')) {
      result[key] = parseFlowSequence(val);
      i++;
      continue;
    }

    // Flow mapping: {a: b}
    if (val.startsWith('{')) {
      result[key] = parseFlowMapping(val);
      i++;
      continue;
    }

    result[key] = castScalar(val);
    i++;
  }

  return { value: result, next: i };
}

function parseMapping(lines, start, seqIndent) {
  const line = lines[start];
  const after = line.replace(/^\s*-\s*/, '');
  // Parse the first key:val from the dash line
  const obj = {};
  const kvMatch = after.match(/^([\w][\w.-]*)\s*:\s*(.*)/);
  if (kvMatch) {
    const key = kvMatch[1];
    let val = kvMatch[2].replace(/#.*$/, '').trim();
    if (val.startsWith('[')) {
      obj[key] = parseFlowSequence(val);
    } else if (val.startsWith('{')) {
      obj[key] = parseFlowMapping(val);
    } else if (val === '' || val === '>' || val === '|') {
      const nextNonEmpty = peekNextContent(lines, start + 1);
      if (nextNonEmpty !== null) {
        const nextIndent = lines[nextNonEmpty].search(/\S/);
        const dashContentIndent = line.search(/\S/) + 2;
        if (nextIndent >= dashContentIndent) {
          if (val === '>' || val === '|') {
            const bs = collectBlockScalar(lines, start + 1, line.search(/\S/) + 1, val === '>');
            obj[key] = bs.text;
            const sub = parseLines(lines, bs.next, seqIndent);
            Object.assign(obj, sub.value);
            return { value: obj, next: sub.next };
          }
          if (lines[nextNonEmpty].trimStart().startsWith('- ')) {
            const sub = parseLines(lines, nextNonEmpty, line.search(/\S/) + 1);
            obj[key] = sub.value;
            const rest = parseLines(lines, sub.next, seqIndent);
            Object.assign(obj, rest.value);
            return { value: obj, next: rest.next };
          }
          const sub = parseLines(lines, start + 1, line.search(/\S/) + 1);
          obj[key] = sub.value;
          return { value: obj, next: sub.next };
        }
      }
      obj[key] = val === '' ? null : '';
    } else {
      obj[key] = castScalar(val);
    }
  }
  // Parse remaining keys at same mapping level
  let i = start + 1;
  const contentIndent = line.search(/\S/) + 2; // indent of content after "- "
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*(#|$)/.test(l)) { i++; continue; }
    const li = l.search(/\S/);
    if (li < contentIndent) break;
    if (li === seqIndent && l.trimStart().startsWith('- ')) break;
    const sub = parseLines(lines, i, seqIndent);
    Object.assign(obj, sub.value);
    i = sub.next;
  }
  return { value: obj, next: i };
}

function collectBlockScalar(lines, start, parentIndent, fold) {
  let i = start;
  const parts = [];
  let blockIndent = -1;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      parts.push('');
      i++;
      continue;
    }
    const li = line.search(/\S/);
    if (li <= parentIndent) break;
    if (blockIndent === -1) blockIndent = li;
    if (li < blockIndent) break;
    parts.push(line.slice(blockIndent));
    i++;
  }
  // Remove trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  const text = fold ? parts.join(' ').replace(/  +/g, ' ').trim() : parts.join('\n');
  return { text, next: i };
}

function peekNextContent(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (!/^\s*(#|$)/.test(lines[i])) return i;
  }
  return null;
}

function parseFlowSequence(str) {
  const inner = str.replace(/^\[/, '').replace(/\]\s*$/, '');
  if (inner.trim() === '') return [];
  return inner.split(',').map(s => castScalar(s.trim().replace(/^['"]|['"]$/g, '')));
}

function parseFlowMapping(str) {
  const inner = str.replace(/^\{/, '').replace(/\}\s*$/, '');
  if (inner.trim() === '') return {};
  const obj = {};
  for (const pair of inner.split(',')) {
    const [k, ...rest] = pair.split(':');
    if (k) obj[k.trim()] = castScalar((rest.join(':') || '').trim().replace(/^['"]|['"]$/g, ''));
  }
  return obj;
}

function castScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  // Quoted string — strip quotes
  if (/^['"].*['"]$/.test(val)) return val.slice(1, -1);
  // Number
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  return val;
}
