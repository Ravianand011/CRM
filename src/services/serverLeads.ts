import type { Lead } from '../types/Lead';

const WEBHOOK_SERVER =
  import.meta.env.VITE_WEBHOOK_URL ||
  'https://crm-production-be3b.up.railway.app';

/** Remove matching lead(s) from Railway in-memory store (best-effort). */
export async function deleteLeadOnServer(lead: Lead): Promise<void> {
  const base = WEBHOOK_SERVER.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/leads/${encodeURIComponent(lead.id)}`, {
      method: 'DELETE',
    });
    if (res.ok) return;
  } catch {
    // fall through to body delete
  }

  try {
    await fetch(`${base}/leads`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: lead.id,
        phone: lead.phone,
        fbLeadId: lead.fbLeadId,
      }),
    });
  } catch (err) {
    console.warn('Server delete failed; local delete + blocklist still apply', err);
  }
}
