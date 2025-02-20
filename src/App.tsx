// import { loadState } from "./storage";
import { Primitive } from "./view_primitive";
import { s } from "./expr";
import { initProcessManager } from "./data";
import { State } from "./process";
import { k } from "./value";

const pm = initProcessManager();

const rootPid = "root_view_manager";
const rootView = State.init(pm, 0).exprValue(
  s.view__component(s.view__desktop()),
);

export function App() {
  return <Primitive id="Receiver" pm={pm} values={[rootView, k(rootPid)]} />;
}
