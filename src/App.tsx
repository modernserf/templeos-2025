import { DB } from "./db";
import { initDB } from "./data";
import { State } from "./state";
import { k, R, v } from "./rule_builder";
import { Query } from "./view_primitive";
import { useEventSource } from "./event_source";

const db = new DB();
db.bulkInsert(initDB);

const qApp = R()
  .r("view__appMenu", [])
  .get("windowId", "db__schema", k("schema__window"))
  .r("view__window", [v("windowId")])
  .build();

export function App() {
  useEventSource();
  const state = State.root(db);
  return <Query state={state} rule={qApp} />;
}
