/** Last 10 digits so +91 / 91 / local formats match. */
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}
