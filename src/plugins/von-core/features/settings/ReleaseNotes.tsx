import React from 'react';

const MAX_INLINE_CHARS = 4096;

interface ReleaseNotesProps {
  markdown: string;
  truncated?: boolean;
  releaseUrl?: string;
}

const safeExternalUrl = (value: string): string => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const renderInline = (source: string, keyPrefix: string, depth = 0): React.ReactNode[] => {
  const value = source.slice(0, MAX_INLINE_CHARS);
  const nodes: React.ReactNode[] = [];
  let plain = '';
  let cursor = 0;

  const flushPlain = () => {
    if (!plain) return;
    nodes.push(plain);
    plain = '';
  };

  while (cursor < value.length) {
    if (value[cursor] === '`') {
      const closing = value.indexOf('`', cursor + 1);
      if (closing > cursor + 1) {
        flushPlain();
        nodes.push(
          <code
            key={`${keyPrefix}-code-${cursor}`}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800 dark:bg-admin-inset dark:text-slate-200"
          >
            {value.slice(cursor + 1, closing)}
          </code>
        );
        cursor = closing + 1;
        continue;
      }
    }

    if (depth < 2 && value.startsWith('**', cursor)) {
      const closing = value.indexOf('**', cursor + 2);
      if (closing > cursor + 2) {
        flushPlain();
        nodes.push(
          <strong
            key={`${keyPrefix}-strong-${cursor}`}
            className="font-semibold text-slate-800 dark:text-slate-100"
          >
            {renderInline(
              value.slice(cursor + 2, closing),
              `${keyPrefix}-strong-${cursor}`,
              depth + 1
            )}
          </strong>
        );
        cursor = closing + 2;
        continue;
      }
    }

    if (depth < 2 && value[cursor] === '*' && value[cursor + 1] !== '*') {
      const closing = value.indexOf('*', cursor + 1);
      if (closing > cursor + 1) {
        flushPlain();
        nodes.push(
          <em key={`${keyPrefix}-em-${cursor}`}>
            {renderInline(value.slice(cursor + 1, closing), `${keyPrefix}-em-${cursor}`, depth + 1)}
          </em>
        );
        cursor = closing + 1;
        continue;
      }
    }

    if (depth < 2 && value[cursor] === '[') {
      const labelEnd = value.indexOf('](', cursor + 1);
      const urlEnd = labelEnd >= 0 ? value.indexOf(')', labelEnd + 2) : -1;
      if (labelEnd > cursor + 1 && urlEnd > labelEnd + 2) {
        const label = value.slice(cursor + 1, labelEnd);
        const href = safeExternalUrl(value.slice(labelEnd + 2, urlEnd).trim());
        flushPlain();
        if (href) {
          nodes.push(
            <a
              key={`${keyPrefix}-link-${cursor}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {renderInline(label, `${keyPrefix}-link-${cursor}`, depth + 1)}
            </a>
          );
        } else {
          nodes.push(label);
        }
        cursor = urlEnd + 1;
        continue;
      }
    }

    plain += value[cursor];
    cursor += 1;
  }

  flushPlain();
  if (source.length > MAX_INLINE_CHARS) nodes.push('...');
  return nodes;
};

interface MarkdownLine {
  kind: 'blank' | 'code-fence' | 'heading' | 'unordered' | 'ordered' | 'text';
  text: string;
  level?: number;
}

const classifyLine = (line: string): MarkdownLine => {
  const trimmed = line.trim();
  if (!trimmed) return { kind: 'blank', text: '' };
  if (trimmed.startsWith('```')) return { kind: 'code-fence', text: trimmed.slice(3) };

  const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (heading) return { kind: 'heading', text: heading[2], level: heading[1].length };

  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return { kind: 'unordered', text: trimmed.slice(2).trim() };
  }

  const ordered = trimmed.match(/^\d{1,3}\.\s+(.+)$/);
  if (ordered) return { kind: 'ordered', text: ordered[1] };

  return { kind: 'text', text: trimmed };
};

const ReleaseNotes: React.FC<ReleaseNotesProps> = ({ markdown, truncated, releaseUrl }) => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n').slice(0, 1000);
  const content: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = classifyLine(lines[index]);

    if (line.kind === 'blank') {
      index += 1;
      continue;
    }

    if (line.kind === 'code-fence') {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && classifyLine(lines[index]).kind !== 'code-fence') {
        code.push(lines[index].slice(0, MAX_INLINE_CHARS));
        index += 1;
      }
      if (index < lines.length) index += 1;
      content.push(
        <pre
          key={`code-${index}`}
          className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 dark:border-admin-border dark:bg-admin-inset"
        >
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (line.kind === 'heading') {
      const headingClass =
        line.level === 1
          ? 'text-base font-bold'
          : line.level === 2
            ? 'text-sm font-bold'
            : 'text-sm font-semibold';
      content.push(
        <h3
          key={`heading-${index}`}
          className={`${headingClass} pt-1 text-slate-900 dark:text-white`}
        >
          {renderInline(line.text, `heading-${index}`)}
        </h3>
      );
      index += 1;
      continue;
    }

    if (line.kind === 'unordered' || line.kind === 'ordered') {
      const listKind = line.kind;
      const items: string[] = [];
      while (index < lines.length) {
        const candidate = classifyLine(lines[index]);
        if (candidate.kind !== listKind) break;
        items.push(candidate.text);
        index += 1;
      }
      const listItems = items.map((item, itemIndex) => (
        <li key={`${listKind}-${index}-${itemIndex}`}>
          {renderInline(item, `${listKind}-${index}-${itemIndex}`)}
        </li>
      ));
      content.push(
        listKind === 'ordered' ? (
          <ol key={`ordered-${index}`} className="list-decimal space-y-1 pl-5">
            {listItems}
          </ol>
        ) : (
          <ul key={`unordered-${index}`} className="list-disc space-y-1 pl-5">
            {listItems}
          </ul>
        )
      );
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = classifyLine(lines[index]);
      if (candidate.kind !== 'text') break;
      paragraph.push(candidate.text);
      index += 1;
    }
    content.push(
      <p key={`paragraph-${index}`} className="leading-6">
        {renderInline(paragraph.join(' '), `paragraph-${index}`)}
      </p>
    );
  }

  const safeReleaseUrl = releaseUrl ? safeExternalUrl(releaseUrl) : '';

  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      {content}
      {truncated && (
        <p className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-admin-border dark:text-slate-400">
          These release notes were shortened for safe display.
          {safeReleaseUrl && (
            <>
              {' '}
              <a
                href={safeReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary-600 underline underline-offset-2 dark:text-primary-400"
              >
                View the complete notes on GitHub.
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
};

export default ReleaseNotes;
