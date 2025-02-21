import { Rec } from "./data";
import { TransactDB } from "./db";
import { EventSource } from "./event_source";
import { debounce } from "./util";
import { Value } from "./value";

const STATE_KEY = "state";

export function loadState(
  db: TransactDB<Rec>,
  eventSource: EventSource<Value>,
) {
  eventSource.addEventListener(
    debounce(1000, (message) => {
      if (message.tag === "box" && message.id === "update") {
        window.localStorage.setItem(STATE_KEY, JSON.stringify(db.dump()));
      }
    }),
  );
  eventSource.addEventListener((message) => {
    if (message.tag === "box" && message.id === "clear") {
      window.localStorage.removeItem(STATE_KEY);
      window.location.reload();
    }
  });

  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY)!);
  } catch {
    return null;
  }
}
