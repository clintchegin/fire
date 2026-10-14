// Test-only stand-in for api.x.ai used by dev-server.mjs when MOCK=1 (the real account had no credits during testing).
// It imitates the model's tool-calling shape: first turn -> set_inputs call, after the tool result -> a reply
// that quotes only numbers from the tool result. It is NOT an LLM and is never used by worker.js in production.
export function installMock() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.x.ai/')) return real(url, init);
    const b = JSON.parse(init.body), msgs = b.messages, last = msgs[msgs.length - 1];
    const cm = msgs.find(m => m.role === 'user' && m.content.startsWith('<calculator_state>')), ctx = cm ? JSON.parse(cm.content.split('\n')[1]) : { inputs: {} };
    const reply = (message) => new Response(JSON.stringify({ model: b.model + ' (MOCK)', choices: [{ message }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (last.role === 'tool') {
      const t = JSON.parse(last.content), o = t.outputsAfterChange || t.outputs, f = n => '$' + Math.round(n).toLocaleString('en-US');
      const fat = o.tiers.find(t => t.tier === 'Fat');
      return reply({ role: 'assistant', content: `Done. Retiring at **${o.retireAge}**, you'd have **${o.balanceAtRetirement}** and reach full FIRE at **${o.fullFireAge}**. You're on pace for ${o.onPaceFor}; Fat FIRE is ${fat.pctFunded} funded.` });
    }
    const q = last.content.toLowerCase(), args = {};
    const m = q.match(/retire at (\d+)/); if (m) args.ret = +m[1];
    if (/\$?10k more/.test(q)) args.contrib = ctx.inputs.contrib + 10000;
    if (/fat fire/.test(q)) args.ret = 55;
    if (/redo/.test(q)) { args.ret = 52; args.contrib = ctx.inputs.contrib + 10000; }
    return reply({ role: 'assistant', content: '', tool_calls: [{ id: 'call_' + Date.now(), type: 'function', function: { name: 'set_inputs', arguments: JSON.stringify(args) } }] });
  };
}
