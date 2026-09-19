import { apiFetch, buildQuery } from "./api";

// ⚠️ Read only, and there is no second function here by design: an entry cannot be changed
// or removed, and the server has no route that would.
export const listAudit = (filters = {}) => apiFetch(`/audit${buildQuery(filters)}`);
