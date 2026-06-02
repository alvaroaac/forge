import type { ReactNode } from 'react';

import { inlineParts } from '../lib/markdown';

function isSafeLinkHref(href: string): boolean {
  const trimmed = href.trim();
  const hasControlCharacter = [...trimmed].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

  if (!trimmed || hasControlCharacter) {
    return false;
  }

  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);
  if (!schemeMatch) {
    return true;
  }

  const scheme = schemeMatch[1].toLowerCase();
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}

export function renderInlineMarkdown(line: string, keyPrefix: string | number): ReactNode[] {
  return inlineParts(line).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.type === 'code') {
      return (
        <code key={key} className="md-code">
          {part.text}
        </code>
      );
    }

    if (part.type === 'ref') {
      return (
        <span key={key} className="md-ref">
          {part.text}
        </span>
      );
    }

    if (part.type === 'mention') {
      return (
        <span key={key} className="md-mention">
          {part.text}
        </span>
      );
    }

    if (part.type === 'strong') {
      return (
        <strong key={key} className="md-strong">
          {part.text}
        </strong>
      );
    }

    if (part.type === 'link') {
      const href = part.href ?? '';
      if (!isSafeLinkHref(href)) {
        return part.text;
      }

      return (
        <a key={key} className="md-link" href={href} target="_blank" rel="noreferrer">
          {part.text}
        </a>
      );
    }

    return part.text;
  });
}
