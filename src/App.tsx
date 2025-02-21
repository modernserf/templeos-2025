import { Primitive } from "./view_primitive";
import { initProcessManager } from "./data";
import { box, k } from "./value";

const pm = initProcessManager();

const rootPid = "root_view_manager";
const rootView = box("view__component", [box("view__desktop", [])]);

export function App() {
  return <Primitive id="Receiver" pm={pm} values={[rootView, k(rootPid)]} />;
}
