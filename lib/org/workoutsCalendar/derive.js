export function groupByDate(workouts) {
  const map = {};
  (Array.isArray(workouts) ? workouts : []).forEach((w) => {
    const iso = String(w?.Date || "").slice(0, 10);
    if (!iso) return;
    if (!map[iso]) map[iso] = [];
    map[iso].push(w);
  });
  Object.keys(map).forEach((k) => {
    map[k].sort((a, b) => String(a?.Title || "").localeCompare(String(b?.Title || "")));
  });
  return map;
}

export function sumCountsForDay(list) {
  const workouts = Array.isArray(list) ? list : [];
  let workoutsCount = workouts.length;
  let athleteCount = 0;
  let itemCount = 0;
  workouts.forEach((w) => {
    athleteCount += Number(w?.athleteCount || 0);
    itemCount += Number(w?.itemCount || 0);
  });
  return { workoutsCount, athleteCount, itemCount };
}
