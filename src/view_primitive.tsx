import {
  Component,
  FC,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { __, l, s } from "./expr";
import { ProcessManager, ensure } from "./process";
import { box, k, printValue, Value } from "./value";
import { debounce } from "./util";

import "./view_primitive.css";
import { EventSource } from "./event_source";

type VC = FC<{
  pm: ProcessManager;
  id: string;
  values: Value[];
}>;

type Props = {
  className: string;
  style: Record<string, unknown>;
  placeholder?: string;
  debounce?: number;
};

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

const Html: VC = ({ pm, values: [tag, props, children] }) => {
  ensure(tag, "string");
  const El = tag.value;
  return (
    <El {...getProps(props)}>
      <Children pm={pm} children={children} />
    </El>
  );
};

const Receiver: VC = ({ pm, values: [proc, maybePid] }) => {
  const [result, setResult] = useState<Value & { tag: "box" }>();

  const maybePidValue = maybePid.tag === "string" ? maybePid.value : undefined;

  useEffect(() => {
    console.log("mount", maybePidValue);
    const eventSource = new EventSource<Value>();
    const renderPid = pm.addExternal(eventSource);
    const procPid = pm.spawn(proc, maybePidValue);
    const unsub = eventSource.addEventListener((it) => {
      setResult(it as Value & { tag: "box" });
    });
    pm.sendAsync(procPid, box("mount", [k(renderPid)]));
    return () => {
      pm.sendAsync(procPid, box("unmount", []));
      unsub();
    };
  }, [pm, proc, maybePidValue]);

  if (!result) return <>loading</>;
  return (
    <ErrorBoundary>
      <Primitive pm={pm} id={result.id} values={result.args} />
    </ErrorBoundary>
  );
};

const String: VC = ({ values: [value] }) => {
  if (value.tag !== "string" && value.tag !== "number") return null;

  return value.value;
};

const Button: VC = ({ pm, values: [props, label, handler] }) => {
  ensure(label, "string");
  return (
    <button
      {...getProps(props)}
      type="button"
      onClick={(e) => {
        pm.sendAsync(
          pm.spawn(handler),
          e.metaKey ? s.click(l(s.meta_key())) : s.click(l()),
        );
      }}
    >
      {label.value}
    </button>
  );
};

const Input: VC = ({ pm, values: [props, value, handler] }) => {
  if (value.tag !== "string" && value.tag !== "number") return null;

  const { debounce: db = 0, ...jsProps } = getProps(props);

  return (
    <input
      {...jsProps}
      defaultValue={value.value}
      onChange={debounce(db, (e) => {
        pm.sendAsync(pm.spawn(handler), box("change", [k(e.target.value)]));
      })}
      onFocus={() => {
        pm.sendAsync(pm.spawn(handler), s.focus());
      }}
      onBlur={() => {
        pm.sendAsync(pm.spawn(handler), s.blur());
      }}
    />
  );
};

const Select: VC = ({ pm, values: [props, value, options, handler] }) => {
  ensure(value, "string");
  ensure(options, "box");

  return (
    <select
      {...getProps(props)}
      value={value.value}
      onChange={(e) => {
        pm.sendAsync(pm.spawn(handler), box("change", [k(e.target.value)]));
      }}
      onFocus={() => {
        pm.sendAsync(pm.spawn(handler), s.focus());
      }}
      onBlur={() => {
        pm.sendAsync(pm.spawn(handler), s.blur());
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
        if (!isCurrent) pm.sendAsync(pm.spawn(handler), s.select_window());
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          pm.sendAsync(pm.spawn(handler), s.back());
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          pm.sendAsync(pm.spawn(handler), s.forward());
        }
      }}
    >
      <Children pm={pm} children={children} />
    </div>
  );
};

const viewPrimitives: Record<string, VC> = {
  Html,
  String,
  Button,
  Select,
  Icon,
  Input,
  WindowContainer,
  Receiver,
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

function Children({ pm, children }: { pm: ProcessManager; children: Value }) {
  if (!children) {
    return (
      <div style={{ backgroundColor: "pink" }}>
        <pre>error: children is undefined</pre>
      </div>
    );
  }
  return (
    <>
      {(children.args as (Value & { tag: "box" })[]).map((arg, i) => (
        <Primitive key={i} pm={pm} id={arg.id} values={arg.args} />
      ))}
    </>
  );
}

export function Primitive({
  pm,
  id,
  values,
}: {
  pm: ProcessManager;
  id: string;
  values: Value[];
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <ErrorBoundary>
      <View pm={pm} id={id} values={values} />
    </ErrorBoundary>
  );
}
