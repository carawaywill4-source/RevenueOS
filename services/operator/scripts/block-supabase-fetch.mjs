const orig = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ? String(input.url) : String(input));
  if (/supabase\.(co|in)|buvfllemxdvmwzhvfori|fnrwzloovduhryynmgok/i.test(url)) {
    console.error(JSON.stringify({ event: 'supabase_network_blocked', url }));
    throw new Error('SUPABASE_NETWORK_BLOCKED:' + url);
  }
  return orig(input, init);
};
