export type ScaleSample = { grams: number; at: number };

const BARE_DECIMAL = /^[-+]?(\d+\.?\d*|\.\d+)$/;
const NON_PRINTABLE = /[^\x20-\x7e]+/g;

export const parseWeightText = (text: string | null): number | null => {
  if (text === null) {
    return null;
  }
  const trimmed = text.replace(NON_PRINTABLE, '').trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith('{')) {
    try {
      const payload: unknown = JSON.parse(trimmed);
      if (typeof payload !== 'object' || payload === null) {
        return null;
      }
      const grams = (payload as { weight_g?: unknown }).weight_g;
      return typeof grams === 'number' && Number.isFinite(grams) ? grams : null;
    } catch {
      return null;
    }
  }
  if (!BARE_DECIMAL.test(trimmed)) {
    return null;
  }
  const grams = Number.parseFloat(trimmed);
  return Number.isFinite(grams) ? grams : null;
};
