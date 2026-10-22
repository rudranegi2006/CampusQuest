// Frontend-only record of which daily riddles the player has already attempted
// (right or wrong), keyed by game day. A wrong answer forfeits the riddle for the day.
// TODO: move to the backend so it survives clearing storage / switching device.
const key = (day) => `cq:riddles-answered:${day}`;

export function loadAnswered(day) {
  try { return JSON.parse(localStorage.getItem(key(day))) ?? []; } catch { return []; }
}

export function markAnswered(day, id) {
  const ids = loadAnswered(day);
  if (ids.includes(id)) return;
  try { localStorage.setItem(key(day), JSON.stringify([...ids, id])); } catch { /* storage unavailable */ }
}

/** Adds `answered` to each riddle: solved on the server, or attempted locally. */
export function withAnswered(data) {
  const done = loadAnswered(data?.day);
  return (data?.riddles ?? []).map((r) => ({ ...r, answered: r.solved || done.includes(r.id) }));
}