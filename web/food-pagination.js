export function clampFoodPageOffset(total, limit, offset) {
  const lastPageOffset = Math.max(0, Math.ceil(total / limit) * limit - limit);
  return Math.min(offset, lastPageOffset);
}
