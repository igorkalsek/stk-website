import { buildMasterApiPath, type PublicYear } from './utils-public-year.js';

const API_BASE = 'https://stk-master-api.igor-kalsek.workers.dev';
const pending = new Map<PublicYear, Promise<unknown>>();

/** Share only overlapping Master reads. Settled responses are never retained here. */
export const fetchPublicMaster = (year: PublicYear): Promise<unknown> => {
  const existing = pending.get(year);
  if (existing) return existing;
  const request = fetch(`${API_BASE}${buildMasterApiPath(year)}`, { headers: { accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      return response.json();
    })
    .finally(() => { pending.delete(year); });
  pending.set(year, request);
  return request;
};
