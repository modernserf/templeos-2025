import { data, initState, Rec } from "./data";
import { DB } from "./db";
import { eventSource } from "./event_source";

const STATE_KEY = "state";

eventSource.addEventListener((db: DB<Rec>) => {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(db.dump()));
});

export function loadState() {
  const res = window.localStorage.getItem(STATE_KEY);
  if (res) {
    const parsed = JSON.parse(res);
    return { ...initState, ...parsed, ...data };
  }
  return { ...initState, ...data };
}

export function clearState() {
  window.localStorage.removeItem(STATE_KEY);
  window.location.reload();
}
