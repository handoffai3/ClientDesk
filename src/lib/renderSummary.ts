const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

// Input is HTML-escaped first; only the tags emitted here can reach the output.
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\*\*/g, '');
}

const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+(.*)$/;
const HASH_HEADING = /^\s*#{1,6}\s+(.*)$/;
const BOLD_HEADING = /^\s*\*\*([^*]+?)\*\*\s*:?\s*$/;
const PLAIN_HEADING = /^\s*([A-Z][A-Za-z ]{1,30}):\s*$/;
const SHORT_LABEL = /^[^.!?;,]{1,40}$/;

export function renderSummary(text: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd());
  const nextIsBullet = (i: number) => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return BULLET.test(lines[j]);
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { closeList(); continue; }

    const bullet = line.match(BULLET);
    if (bullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();

    const heading = line.match(HASH_HEADING) || line.match(BOLD_HEADING) || line.match(PLAIN_HEADING);
    if (heading) { out.push(`<h4>${inline(heading[1].replace(/:\s*$/, ''))}</h4>`); continue; }
    // A bare short line directly above a bullet list ("Progress") is a heading.
    if (SHORT_LABEL.test(line.trim()) && nextIsBullet(i)) { out.push(`<h4>${inline(line.trim())}</h4>`); continue; }

    out.push(`<p>${inline(line.trim())}</p>`);
  }
  closeList();
  return out.join('');
}
