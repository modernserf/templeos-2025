// import { loadState } from "./storage";
import { Primitive } from "./view_primitive";
import { $, s, seq } from "./v3/expr";
import { initProcessManager } from "./data";
import { useEffect, useState } from "react";
import { EventSource } from "./event_source";
import { Value } from "./v3/value";

const p = initProcessManager();
const eventSource = new EventSource<Value>();
p.addExternal("root_view", eventSource);

const rootView = s.loop(
  seq(
    s.receive(s.render()),
    s.timestamp($.ts),
    s.proc_send("root_view", s.String($.ts)),
  ),
);

const rootPid = p.runExpr(rootView);

export function App() {
  const [result, setResult] = useState<Value>();
  useEffect(() => {
    return eventSource.addEventListener((it) => setResult(it));
  }, []);
  useEffect(() => {
    p.sendAsync(rootPid, s.render());
    const h = setInterval(() => p.sendAsync(rootPid, s.render()), 1000);
    return () => clearInterval(h);
  }, []);

  if (!result) return <></>;
  return (
    <>
      <Primitive id={result.id} values={result.args} />
    </>
  );
}
