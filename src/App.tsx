import { State } from "./state";
import { data } from "./data";
import { Query } from "./view_primitive";
import { useEventSource } from "./event_source";
import { s, v } from "./expr";

const qApp = s(
  ",",
  s("view__appMenu"),
  s("get_field_value", v.w, "db__schema", "schema__window"),
  s("view__window", v.w)
);

const state = State.root(data);
export function App() {
  useEventSource();
  return <Query state={state} clause={qApp} />;
}
