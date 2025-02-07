import { data, initState } from "./data";
import { eventSource } from "./event_source";
import { debounce } from "./util";

const STATE_KEY = "state";

eventSource.addEventListener(
  debounce(1000, (db) => {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(db.dump()));
  }),
);

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
