// import { loadState } from "./storage";
import { ErrorBoundary, Primitive } from "./view_primitive";
import { $, s, seq } from "./expr";
import { initProcessManager } from "./data";
import { useEffect, useState } from "react";
import { EventSource } from "./event_source";
import { Value } from "./value";

const p = initProcessManager();
const eventSource = new EventSource<Value>();
p.addExternal(eventSource, "root_view");

const rootView = s.loop(
  seq(
    s.receive(s.render()),
    s.view__desktop($.out),
    s.send("root_view", $.out),
  ),
);

const rootPid = "root_view_manager";
p.runExpr(rootView, rootPid);

export function App() {
  const [result, setResult] = useState<Value & { tag: "box" }>();
  useEffect(() => {
    return eventSource.addEventListener((it) => {
      setResult(it as Value & { tag: "box" });
    });
  }, []);
  useEffect(() => {
    p.sendAsync(rootPid, s.render());
  }, []);

  if (!result) return <></>;
  return (
    <ErrorBoundary>
      <Primitive pm={p} id={result.id} values={result.args} />
    </ErrorBoundary>
  );
}
