import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';

// A bounded manual check; no retries, no key or reasoning output.
const fileEnv = dotenv.parse(await readFile(new URL('../.env.bigmodel.local', import.meta.url)));
const env = { ...fileEnv, ...process.env };
const key = env.BIGMODEL_API_KEY;
if (!key) throw new Error('BIGMODEL_API_KEY is required in .env.bigmodel.local');
const base = 'https://open.bigmodel.cn/api/paas/v4';
const chatBase = env.BIGMODEL_CHAT_API_URL?.trim().replace(/\/+$/, '') || base;
const results = await Promise.all(
  [
    [
      'chat/completions',
      {
        model: env.BIGMODEL_CHAT_MODEL ?? 'glm-5.3-flash',
        messages: [{ role: 'user', content: 'Greet an English learner in one short sentence.' }],
        thinking: { type: 'enabled' },
        reasoning_effort: 'low',
        max_tokens: 2048,
      },
    ],
    [
      'embeddings',
      {
        model: env.BIGMODEL_EMBEDDING_MODEL ?? 'embedding-3',
        input: ['A learner orders coffee.'],
        dimensions: 1024,
      },
    ],
  ]
    .filter(([endpoint]) => endpoint !== 'embeddings' || env.VECTOR_MEMORY_ENABLED !== 'false')
    .map(async ([endpoint, body]) => {
      const started = Date.now();
      try {
        const response = await fetch(
          `${endpoint === 'chat/completions' ? chatBase : base}/${endpoint}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(90_000),
          },
        );
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        const dimensions = json.data?.[0]?.embedding?.length;
        const usable =
          response.ok &&
          (endpoint === 'embeddings'
            ? dimensions === 1024
            : typeof content === 'string' && content.trim().length > 0);
        console.log(
          JSON.stringify(
            {
              endpoint,
              status: response.status,
              usable,
              ms: Date.now() - started,
              requestedModel: body.model,
              returnedModel: json.model,
              content,
              dimensions,
              usage: json.usage,
              error: json.error,
            },
            (_name, value) =>
              typeof value === 'string' ? value.replaceAll(key, '[redacted]') : value,
          ),
        );
        return usable;
      } catch (error) {
        console.error(`${endpoint}: ${String(error.message).replaceAll(key, '[redacted]')}`);
        return false;
      }
    }),
);
if (results.some((ok) => !ok)) process.exitCode = 1;
