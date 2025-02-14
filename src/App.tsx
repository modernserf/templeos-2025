import { ProcessManager } from "./v3/process_manager";
// import { loadState } from "./storage";
import { Primitive } from "./view_primitive";
import { $, s, seq } from "./v3/expr";
import { TransactDB } from "./db";
import { Rec } from "./data";
import { rules, rulePrimitives } from "./v3/rule_primitive";
import { useEffect, useState } from "react";
import { EventSource } from "./event_source";
import { Value } from "./v3/value";

const db = new TransactDB<Rec>();
db.bulkInsert(rules);
const p = ProcessManager.init(db, rulePrimitives);
const eventSource = new EventSource<Value>();
p.addExternal("root_view", eventSource);

const rootView = s.loop(
  seq(
    s.receive(s.render()),
    s.timestamp($.ts),
    s("send", "root_view", s.String($.ts)),
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
