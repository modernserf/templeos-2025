import { Primitive } from "./view_primitive";
import { initProcessManager } from "./data";
import { box, k } from "./value";

const pm = initProcessManager();
const rootViewPid = k("root_view_manager");
pm.spawn(box("boot", [rootViewPid]));

export function App() {
  return <Primitive id="Receiver2" pm={pm} values={[rootViewPid]} />;
}
