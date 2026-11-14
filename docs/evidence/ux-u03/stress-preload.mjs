// Test-only fetch override. Use only for a local build, never deploy this output.
export const description = '<img src=x onerror="window.u03Unsafe=true">\nOtroci < 10 let: brezplačno & odrasli 25 € do 20. 11. 2026.\n' + 'Podrobni pogoji plačila na ekipo in za posamezni krog. '.repeat(30) + '\n' + 'DolgaBeseda'.repeat(80);
if (process.env.U03_STRESS_BUILD === '1') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = new URL(String(input));
    if (url.hostname !== 'stk-master-api.igor-kalsek.workers.dev' || url.pathname !== '/additional' || url.searchParams.has('year')) return response;
    const data = await response.json();
    const row = data.data.find(row => String(row.master_row) === '267');
    if (!row) throw new Error('Velenje fixture target missing');
    row.prijavnina_opis = description;
    return new Response(JSON.stringify(data), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  };
}
