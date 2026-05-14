import type { ReactNode } from 'react';

import { inlineParts } from '../lib/markdown';

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
      return (
        <a key={key} className="md-link" href={part.href} target="_blank" rel="noreferrer">
          {part.text}
        </a>
      );
    }

    return part.text;
  });
}
