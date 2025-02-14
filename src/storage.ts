import { data, initState } from "./old-data";
import { wholeDatabaseEventSource } from "./event_source";
import { debounce } from "./util";

const STATE_KEY = "state";

export function loadState() {
  wholeDatabaseEventSource.addEventListener(
    debounce(1000, (db) => {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(db.dump()));
    }),
  );

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
