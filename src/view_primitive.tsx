import { Component, FC, ReactNode, useEffect, useRef, useState } from "react";
import { __, l, s } from "./expr";
import { Exception, ProcessManager, ensure, ensurePid } from "./process";
import { box, k, printValue, Value } from "./value";

import "./view_primitive.css";
import { EventSource } from "./event_source";

type VC = FC<{
  pm: ProcessManager;
  id: string;
  values: Value[];
  pid: string | number;
}>;

type Props = {
  className: string;
  style: Record<string, unknown>;
  placeholder?: string;
  debounce?: number;
};

function handle(
  pm: ProcessManager,
  pid: string | number,
  handler: Value,
  arg: Value,
) {
  const childPid = pm.getPid();
  try {
    return pm.spawn(box("apply", [box("", [arg]), handler]), childPid, pid);
  } catch (e) {
    if (e instanceof Exception) {
      pm.exitAsync(childPid, e.error);
    } else {
      throw e;
    }
  }
}

function getProps(props: Value): Props {
  const out: Record<string, unknown> = {};
  const classList: string[] = [];
  const style: Record<string, string> = {};
  ensure(props, "box");
  for (const arg of props.args) {
    ensure(arg, "box");
    const { id, args } = arg;
    switch (id) {
      case "class":
        ensure(args[0], "string");
        classList.push(args[0].value);
        break;
      case "style":
        ensure(args[0], "string");
        ensure(args[1], "string");
        style[args[0].value] = args[1].value;
        break;
      case "placeholder":
        ensure(args[0], "string");
        out.placeholder = args[0].value;
        break;
      case "debounce":
        ensure(args[0], "number");
        out.debounce = args[0].value;
    }
  }
  return { ...out, className: classList.join(" "), style };
}

const Html: VC = ({ pm, values: [tag, props, children], pid }) => {
  ensure(tag, "string");
  const El = tag.value;
  return (
    <El {...getProps(props)}>
      <Children pid={pid} pm={pm} children={children} />
    </El>
  );
};

// component is spawned outside of view
const Receiver2: VC = ({ pm, values: [procPid] }) => {
  ensurePid(procPid);
  const [result, setResult] = useState<Value & { tag: "box" }>();
  useEffect(() => {
    const eventSource = new EventSource<Value>();
    const renderPid = pm.addExternal(eventSource);
    const unsub = eventSource.addEventListener((it) => {
      setResult(it as Value & { tag: "box" });
    });
    pm.sendAsync(procPid.value, box("mount", [k(renderPid)]));
    return () => {
      pm.sendAsync(procPid.value, box("unmount", []));
      unsub();
    };
  }, [pm, procPid.value]);

  if (!result) return <>loading</>;
  return (
    <ErrorBoundary>
      <Primitive
        pid={procPid.value}
        pm={pm}
        id={result.id}
        values={result.args}
      />
    </ErrorBoundary>
  );
};

const Receiver: VC = ({ pm, values: [proc], pid }) => {
  const [result, setResult] = useState<Value & { tag: "box" }>();
  const procPidRef = useRef(pid);

  useEffect(() => {
    const eventSource = new EventSource<Value>();
    const renderPid = pm.addExternal(eventSource);
    const procPid = pm.spawn(proc, undefined, pid);
    procPidRef.current = procPid;
    const unsub = eventSource.addEventListener((it) => {
      setResult(it as Value & { tag: "box" });
    });
    pm.sendAsync(procPid, box("mount", [k(renderPid)]));
    return () => {
      pm.sendAsync(procPid, box("unmount", []));
      unsub();
    };
  }, [pm, proc, pid]);

  if (!result) return <>loading</>;
  return (
    <ErrorBoundary>
      <Primitive
        pid={procPidRef.current}
        pm={pm}
        id={result.id}
        values={result.args}
      />
    </ErrorBoundary>
  );
};

const Clickable: VC = ({ pm, values: [props, handler, children], pid }) => {
  return (
    <div
      {...getProps(props)}
      onClick={() => {
        handle(pm, pid, handler, s.click(l()));
      }}
    >
      <Children pid={pid} pm={pm} children={children} />
    </div>
  );
};

const Button: VC = ({ pm, values: [props, label, handler], pid }) => {
  return (
    <button
      {...getProps(props)}
      type="button"
      onClick={(e) => {
        handle(
          pm,
          pid,
          handler,
          e.metaKey ? s.click(l(s.meta_key())) : s.click(l()),
        );
      }}
    >
      <Children pid={pid} pm={pm} children={box("", [label])} />
    </button>
  );
};

const Input: VC = ({ pm, values: [props, value, handler], pid }) => {
  ensure(value, "string");
  const [localValue, setLocalValue] = useState(value.value);
  const localSource = useRef(false);
  const timeout = useRef(0);

  const { debounce: db = 0, ...jsProps } = getProps(props);

  return (
    <input
      {...jsProps}
      value={localSource.current ? localValue : value.value}
      onChange={(e) => {
        setLocalValue(e.target.value);
        if (timeout.current) {
          clearTimeout(timeout.current);
        }
        localSource.current = true;
        timeout.current = setTimeout(() => {
          localSource.current = false;
          handle(pm, pid, handler, box("change", [k(e.target.value)]));
          timeout.current = 0;
        }, db);
      }}
      onFocus={() => {
        handle(pm, pid, handler, s.focus());
      }}
      onBlur={(e) => {
        if (e.relatedTarget instanceof HTMLSelectElement) {
          e.target.focus();
        } else {
          handle(pm, pid, handler, s.blur());
        }
      }}
      onSelect={(e) => {
        handle(
          pm,
          pid,
          handler,
          box("select", [k(e.target.selectionStart), k(e.target.selectionEnd)]),
        );
      }}
    />
  );
};

const Textarea: VC = ({ pm, values: [props, value, handler], pid }) => {
  ensure(value, "string");
  const [localValue, setLocalValue] = useState(value.value);
  const localSource = useRef(false);
  const timeout = useRef(0);
  const { debounce: db = 0, ...jsProps } = getProps(props);

  return (
    <textarea
      {...jsProps}
      value={localSource.current ? localValue : value.value}
      onChange={(e) => {
        setLocalValue(e.target.value);
        if (timeout.current) {
          clearTimeout(timeout.current);
        }
        localSource.current = true;
        timeout.current = setTimeout(() => {
          localSource.current = false;
          handle(pm, pid, handler, box("change", [k(e.target.value)]));
          timeout.current = 0;
        }, db);
      }}
      onFocus={() => {
        handle(pm, pid, handler, s.focus());
      }}
      onBlur={(e) => {
        if (e.relatedTarget instanceof HTMLSelectElement) {
          e.target.focus();
        } else {
          handle(pm, pid, handler, s.blur());
        }
      }}
      onSelect={(e) => {
        handle(
          pm,
          pid,
          handler,
          box("select", [k(e.target.selectionStart), k(e.target.selectionEnd)]),
        );
      }}
    />
  );
};

const Select: VC = ({ pm, values: [props, value, options, handler], pid }) => {
  ensure(value, "string");
  ensure(options, "box");

  return (
    <select
      {...getProps(props)}
      value={value.value}
      onChange={(e) => {
        handle(pm, pid, handler, box("change", [k(e.target.value)]));
      }}
      onFocus={() => {
        handle(pm, pid, handler, s.focus());
      }}
      onBlur={() => {
        handle(pm, pid, handler, s.blur());
      }}
    >
      {options.args.map((opt) => {
        ensure(opt, "box");
        const [id, label] = opt.args;
        ensure(id, "string");
        ensure(label, "string");
        return (
          <option key={id.value} value={id.value}>
            {label.value}
          </option>
        );
      })}
    </select>
  );
};

const Icon: VC = () => (
  <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>
);

const WindowContainer: VC = ({
  pm,
  values: [windowId, currentWindowId, handler, children],
  pid,
}) => {
  ensure(windowId, "string");
  ensure(currentWindowId, "string");
  const isCurrent = windowId.value === currentWindowId.value;
  return (
    <div
      tabIndex={0}
      className={["AppWindow", isCurrent && "AppWindow--current"]
        .filter(Boolean)
        .join(" ")}
      onMouseDownCapture={() => {
        if (!isCurrent) handle(pm, pid, handler, s.select_window());
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          handle(pm, pid, handler, s.back());
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          handle(pm, pid, handler, s.forward());
        }
      }}
    >
      <Children pid={pid} pm={pm} children={children} />
    </div>
  );
};

const Null: VC = () => {
  return null;
};

const viewPrimitives: Record<string, VC> = {
  Html,
  Clickable,
  Button,
  Select,
  Icon,
  Input,
  Textarea,
  WindowContainer,
  Receiver,
  Receiver2,
  Null,
};

const DefaultRenderer: VC = ({ id, values }) => {
  return (
    <div style={{ backgroundColor: "pink" }}>
      <pre>{printValue(box(id, values ?? []))}</pre>
    </div>
  );
};

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ backgroundColor: "pink" }}>
          <div>{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Children({
  pm,
  children,
  pid,
}: {
  pm: ProcessManager;
  children: Value;
  pid: string | number;
}) {
  if (!children) {
    return (
      <div style={{ backgroundColor: "pink" }}>
        <pre>error: children is undefined</pre>
      </div>
    );
  }
  return (
    <>
      {(children.args as Value[]).map((arg, i) =>
        arg.tag === "box" ? (
          <Primitive pid={pid} key={i} pm={pm} id={arg.id} values={arg.args} />
        ) : (
          (arg as Value & { tag: "string" }).value
        ),
      )}
    </>
  );
}

export function Primitive({
  pm,
  id,
  values,
  pid,
}: {
  pm: ProcessManager;
  id: string;
  values: Value[];
  pid: string | number;
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <ErrorBoundary>
      <View pm={pm} id={id} values={values} pid={pid} />
    </ErrorBoundary>
  );
}
