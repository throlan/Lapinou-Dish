export function ageAtDate(birthDate, asOfDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate ?? '')) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(asOf.getTime()) || birth.toISOString().slice(0, 10) !== birthDate || asOf.toISOString().slice(0, 10) !== asOfDate || birth > asOf) return null;
  return asOf.getUTCFullYear() - birth.getUTCFullYear() - (asOfDate.slice(5) < birthDate.slice(5) ? 1 : 0);
}

export function effectiveDatedEntry(entries, date) {
  return (entries ?? []).find(entry => entry.effectiveFrom <= date) ?? null;
}
