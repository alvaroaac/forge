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

    return part.text;
  });
}
