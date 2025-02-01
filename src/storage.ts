import { data } from "./data";
import { eventSource } from "./event_source";

const STATE_KEY = "state";

eventSource.addEventListener((dbDump) => {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(dbDump));
});

export function loadState() {
  try {
    const res = window.localStorage.getItem(STATE_KEY);
    if (res) return JSON.parse(res);
    return data;
  } catch (e) {
    console.error(e);
    return data;
  }
}

export function clearState() {
  window.localStorage.removeItem(STATE_KEY);
  window.location.reload();
}
