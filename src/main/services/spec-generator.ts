import type { MessageStreamEvent, MessageStreamParams } from '@anthropic-ai/sdk/resources/messages';

type MessageClient = {
  messages: {
    stream: (params: MessageStreamParams) => AsyncIterable<MessageStreamEvent>;
  };
};

export interface StreamSpecInput {
  client: MessageClient;
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
}

function extractDelta(event: MessageStreamEvent): string {
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
  for await (const event of stream) {
    const delta = extractDelta(event);
    if (!delta) continue;
    full += delta;
    input.onChunk(delta);
  }
  return full;
}
