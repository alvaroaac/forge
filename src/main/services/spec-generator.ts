import Anthropic from '@anthropic-ai/sdk';

export interface StreamSpecInput {
  client: Anthropic;
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
}

function extractDelta(event: { type: string; delta?: { type: string; text?: string } }): string {
  if (event.type !== 'content_block_delta') return '';
  if (event.delta?.type !== 'text_delta') return '';
  return event.delta.text ?? '';
}

export async function streamSpec(input: StreamSpecInput): Promise<string> {
  const stream = input.client.messages.stream({
    model: input.model,
    max_tokens: 2048,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  });
  let full = '';
  for await (const event of stream as AsyncIterable<unknown>) {
    const delta = extractDelta(event as { type: string; delta?: { type: string; text?: string } });
    if (!delta) continue;
    full += delta;
    input.onChunk(delta);
  }
  return full;
}
