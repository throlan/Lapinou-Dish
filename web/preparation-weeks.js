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

// Calendar weeks are clipped to the shopping period. A blank partial week must
// not shift a two-week run: default to the first week with a batch menu.
export function batchCookingWindow(startDate, endDate, selection = {}, preparations = []) {
  const weeks = preparationWeeks(startDate, endDate);
  if (!weeks.length) return null;
  const firstBatchDate = preparations.filter(item => item.productionType === 'batch_cooking')
    .map(item => item.firstDate).sort()[0];
  const firstPlanned = weeks.find(week => firstBatchDate >= week.start && firstBatchDate <= week.end);
  const chosen = weeks.find(week => week.monday === selection.monday) ?? firstPlanned ?? weeks[0];
  const duration = ['1', '2', '3', 'all'].includes(String(selection.duration)) ? String(selection.duration) : '1';
  const index = weeks.indexOf(chosen);
  const selected = duration === 'all' ? weeks : weeks.slice(index, index + Number(duration));
  return {weeks, monday: chosen.monday, duration, start: selected[0].start,
    end: selected.at(-1).end, weekCount: selected.length};
}
