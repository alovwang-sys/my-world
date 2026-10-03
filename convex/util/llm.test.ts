import { jest } from '@jest/globals';
import { chatCompletion, fetchEmbeddingBatch, getLLMConfig } from './llm';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

describe('BigModel adapter', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LLM_PROVIDER: 'bigmodel',
      BIGMODEL_API_KEY: 'test-key',
      BIGMODEL_CHAT_MODEL: 'glm-5.3-flash',
      BIGMODEL_EMBEDDING_MODEL: 'embedding-3',
      BIGMODEL_CHAT_API_URL: '',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('uses the requested provider even if another provider key exists', () => {
    process.env.OPENAI_API_KEY = 'unused';
    expect(getLLMConfig().provider).toBe('bigmodel');
    expect(getLLMConfig().chatModel).toBe('glm-5.3-flash');
    delete process.env.BIGMODEL_API_KEY;
    expect(() => getLLMConfig()).toThrow('BIGMODEL_API_KEY is required');
  });

  test('uses the v4 chat endpoint and reserves reasoning tokens for short answers', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '5' }, finish_reason: 'stop' }] }),
      );
    globalThis.fetch = fetchMock;
    const result = await chatCompletion({
      messages: [{ role: 'user', content: 'Rate this memory. Number only.' }],
      max_tokens: 1,
      stop: 'END',
    });
    expect(result.content).toBe('5');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(JSON.parse(options?.body as string)).toMatchObject({
      model: 'glm-5.3-flash',
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
      max_tokens: 2048,
      stop: ['END'],
    });
  });

  test('keeps reasoning content out of streamed dialogue', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"delta":{"reasoning_content":"Private reasoning"}}]}\n\n' +
              'data: {"choices":[{"delta":{"content":"Hello!"}}]}\n\n' +
              'data: [DONE]\n\n',
          ),
        );
        controller.close();
      },
    });
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    const result = await chatCompletion({ messages: [], stream: true });
    expect(await result.content.readAll()).toBe('Hello!');
  });

  test('separates the configured chat gateway from the embedding gateway', async () => {
    process.env.BIGMODEL_CHAT_API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/';
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'Hello!' } }] }))
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ index: 0, embedding: Array(1024).fill(0) }] }),
      );
    globalThis.fetch = fetchMock;
    await chatCompletion({ messages: [] });
    await fetchEmbeddingBatch(['Memory']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',
      'https://open.bigmodel.cn/api/paas/v4/embeddings',
    ]);
  });

  test('requests 1024-dimensional memories and restores input order', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [
          { index: 1, embedding: Array(1024).fill(2) },
          { index: 0, embedding: Array(1024).fill(1) },
        ],
        usage: { total_tokens: 8 },
      }),
    );
    globalThis.fetch = fetchMock;
    const result = await fetchEmbeddingBatch(['First\nline', 'Second']);
    expect(result.embeddings.map((embedding) => embedding[0])).toEqual([1, 2]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/embeddings');
    expect(JSON.parse(options?.body as string)).toEqual({
      model: 'embedding-3',
      dimensions: 1024,
      input: ['First line', 'Second'],
    });
  });

  test('rejects incompatible embedding dimensions before writing memories', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ index: 0, embedding: Array(2048).fill(0) }],
      }),
    );
    await expect(fetchEmbeddingBatch(['Memory'])).rejects.toThrow('expected 1024 dimensions');
  });

  test.each(['chat', 'embedding'])('does not retry insufficient credit for %s', async (kind) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ error: { code: '1113', message: 'Insufficient credit' } }, { status: 429 }),
      );
    globalThis.fetch = fetchMock;
    const request =
      kind === 'chat' ? chatCompletion({ messages: [] }) : fetchEmbeddingBatch(['Memory']);
    await expect(request).rejects.toThrow('1113');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('rejects an answer containing only reasoning', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          { message: { content: '', reasoning_content: 'Thinking' }, finish_reason: 'length' },
        ],
      }),
    );
    await expect(chatCompletion({ messages: [] })).rejects.toThrow('Empty chat completion');
  });

  test('retries a TLS failure with the remaining total time budget', async () => {
    jest.useFakeTimers();
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        jest.setSystemTime(Date.now() + 40_000);
        throw new TypeError('tls handshake eof');
      })
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'Hello!' } }] }));
    globalThis.fetch = fetchMock;
    try {
      const request = chatCompletion({ messages: [] });
      await jest.advanceTimersByTimeAsync(3000);
      expect((await request).content).toBe('Hello!');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(timeout.mock.calls[0][0]).toBe(90_000);
      expect(timeout.mock.calls[1][0]).toBeLessThan(50_000);
    } finally {
      jest.useRealTimers();
    }
  });
});
