// An agent adapter for any OpenAI-compatible Chat Completions endpoint
// (support code; described in Chapter 14 but not printed).
// Env: EVAL_BASE_URL (e.g. https://api.openai.com/v1), EVAL_API_KEY, EVAL_MODEL, and
// optionally EVAL_EXTRA_BODY, a JSON object merged into every request body.
export function chatAgent({ baseUrl = process.env.EVAL_BASE_URL, apiKey = process.env.EVAL_API_KEY,
                            model = process.env.EVAL_MODEL, temperature } = {}) {
  if (!baseUrl || !apiKey || !model) throw new Error('Set EVAL_BASE_URL, EVAL_API_KEY and EVAL_MODEL');
  const system = 'You are a browser agent helping the user on the page they have open. ' +
    'Use the page\'s tools to do what the user asks. Today is ' + new Date().toISOString().slice(0, 10) + '.';
  return {
    async next({ messages, tools }) {
      const chat = [{ role: 'system', content: system }];
      for (const m of messages) {
        if (m.role === 'user') chat.push({ role: 'user', content: m.content });
        if (m.role === 'tool') {
          const id = `call_${chat.length}`;
          chat.push({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function',
            function: { name: m.name, arguments: JSON.stringify(m.call.arguments) } }] });
          chat.push({ role: 'tool', tool_call_id: id, content: m.content });
        }
      }
      const body = {
        model, messages: chat, tool_choice: 'auto', parallel_tool_calls: false,
        tools: tools.map((t) => ({ type: 'function', function: {
          name: t.name, description: t.description,
          parameters: t.inputSchema ?? { type: 'object', properties: {} } } }))
      };
      if (temperature !== undefined) body.temperature = temperature;
      Object.assign(body, JSON.parse(process.env.EVAL_EXTRA_BODY ?? '{}'));
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(60_000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`model endpoint answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const choice = (await res.json()).choices[0].message;
      const tc = choice.tool_calls?.[0];
      if (!tc) return { call: null, text: choice.content };
      return { call: { functionName: tc.function.name, arguments: JSON.parse(tc.function.arguments || '{}') } };
    }
  };
}
