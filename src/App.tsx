import { State } from "./state";
import { loadState } from "./storage";
import { Primitive } from "./view_primitive";
import { useEventSource } from "./event_source";
import { rootView } from "./data/core";
import { $ } from "./expr";

const state = State.root(loadState());
window.db = state.db;

export function App() {
  useEventSource();
  const outVar = $.out;
  const res = state.render_(rootView(outVar), outVar);
  return (
    <>
      {res.map((view, i) => (
        <Primitive key={i} state={state} id={view.id} values={view.args} />
      ))}
    </>
  );
}
