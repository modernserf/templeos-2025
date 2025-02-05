import { State } from "./state";
import { clearState, loadState } from "./storage";
import { Query } from "./view_primitive";
import { useEventSource } from "./event_source";
import { rootView } from "./view";

const state = State.root(loadState());
window.db = state.db;
export function App() {
  useEventSource();
  return (
    <>
      <Query state={state} clause={rootView} />
      <button style={{ marginTop: "1rem" }} onClick={clearState}>
        Clear state
      </button>
    </>
  );
}
