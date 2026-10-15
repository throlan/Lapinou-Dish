function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function preparationWeeks(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return [];
  const firstDay = new Date(`${startDate}T12:00:00Z`);
  const monday = addDays(startDate, -((firstDay.getUTCDay() + 6) % 7));
  const weeks = [];
  for (let weekStart = monday; weekStart <= endDate; weekStart = addDays(weekStart, 7)) {
    const sunday = addDays(weekStart, 6);
    weeks.push({
      monday: weekStart,
      start: weekStart < startDate ? startDate : weekStart,
      end: sunday > endDate ? endDate : sunday,
    });
  }
  return weeks;
}
