import { getDataSource } from './data-source';

export { getDataSource };

export async function testConnection() {
  const ds = await getDataSource();
  try {
    await ds.query('SELECT 1');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
