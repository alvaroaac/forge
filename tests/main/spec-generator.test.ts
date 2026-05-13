import { describe, expect, it, vi } from 'vitest';
import { streamSpec } from '../../src/main/services/spec-generator';
import type { MessageStreamEvent, MessageStreamParams } from '@anthropic-ai/sdk/resources/messages';

interface FakeAnthropic {
  messages: {
    stream: (params: MessageStreamParams) => AsyncIterable<MessageStreamEvent>;
  };
  streamCalls: MessageStreamParams[];
}

function makeStream(events: MessageStreamEvent[]): AsyncIterable<MessageStreamEvent> {
  async function* gen() {
    for (const event of events) {
      yield event;
    }
  }
  return {
    [Symbol.asyncIterator]: () => gen(),
  };
}

function makeFakeAnthropic(events: MessageStreamEvent[]): FakeAnthropic {
  const streamCalls: MessageStreamParams[] = [];
  const stream = vi.fn((_params: MessageStreamParams) => {
    streamCalls.push(_params);
    return makeStream(events);
  });
  return { messages: { stream }, streamCalls };
}

describe('streamSpec', () => {
  it('emits each text delta to onChunk then resolves with full text', async () => {
    const events: MessageStreamEvent[] = [
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '# Spec\n' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'body' } },
    ];
    const anthropic = makeFakeAnthropic(events);
    const chunks: string[] = [];
    const full = await streamSpec({
      client: anthropic,
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: (c) => chunks.push(c),
    });
    expect(chunks).toEqual(['# Spec\n', 'body']);
    expect(full).toBe('# Spec\nbody');
    expect(anthropic.messages.stream).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'sys',
      messages: [{ role: 'user', content: 'user' }],
    });
    expect(anthropic.messages.stream).toHaveBeenCalledTimes(1);
    expect(anthropic.streamCalls).toHaveLength(1);
    expect(anthropic.streamCalls[0].messages).toHaveLength(1);
  });

  it('ignores non-text stream events and keeps streaming output unchanged', async () => {
    const events: MessageStreamEvent[] = [
      {
        type: 'message_delta',
        delta: { stop_reason: null, stop_sequence: null },
        usage: { output_tokens: 0 },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"x":' },
      },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'keep' } },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '1' },
      },
    ];
    const anthropic = makeFakeAnthropic(events);
    const chunks: string[] = [];
    const full = await streamSpec({
      client: anthropic,
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: (c) => chunks.push(c),
    });
    expect(chunks).toEqual(['keep']);
    expect(full).toBe('keep');
  });
});
