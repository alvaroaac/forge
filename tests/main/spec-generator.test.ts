import { describe, expect, it } from 'vitest';
import { streamSpec } from '../../src/main/services/spec-generator';
import type Anthropic from '@anthropic-ai/sdk';

interface FakeAnthropic {
  messages: {
    stream: () => AsyncIterable<{ type: string; delta?: { type: string; text?: string } }>;
  };
}

function makeFakeAnthropic(deltas: string[]): FakeAnthropic {
  async function* gen() {
    for (const text of deltas) {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
    }
  }
  return {
    messages: {
      stream: () => ({
        [Symbol.asyncIterator]: () => gen()[Symbol.asyncIterator](),
      }),
    },
  };
}

describe('streamSpec', () => {
  it('emits each text delta to onChunk then resolves with full text', async () => {
    const anthropic = makeFakeAnthropic(['# Spec\n', 'body']);
    const chunks: string[] = [];
    const full = await streamSpec({
      client: anthropic as unknown as Anthropic,
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: (c) => chunks.push(c),
    });
    expect(chunks).toEqual(['# Spec\n', 'body']);
    expect(full).toBe('# Spec\nbody');
  });
});
