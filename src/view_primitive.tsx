import { Component, FC, ReactNode } from "react";
import { __, l, s } from "./v3/expr";
import "./view_primitive.css";
// import { useMessageEventSource, useStateCallback } from "./event_source";
// import { debounce } from "./util";
import { Process } from "./v3/process";
import { box, ensure, printValue, Value } from "./v3/value";

type VC = FC<{
  process: Process;
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

const Html: VC = ({ process, values: [tag, props, children] }) => {
  ensure(tag, "string");
  const El = tag.value;
  return (
    <El {...getProps(props)}>
      <Children process={process} children={children} />
    </El>
  );
};

// const Receive: VC = ({ process, values: [pattern, goal, out, render] }) => {
//   const messageState = useMessageEventSource(process, pattern, goal);
//   const children = messageState.fork().render(render, out);

//   return (
//     <Children
//       process={messageState}
//       children={{ tag: "box", id: "", args: children }}
//     />
//   );
// };

const String: VC = ({ values: [value] }) => {
  if (value.tag !== "string" && value.tag !== "number") return null;

  return value.value;
};

const Button: VC = ({ process, values: [props, label, next, onClick] }) => {
  // const handle = useStateCallback(process);
  ensure(label, "string");
  return (
    <button
      {...getProps(props)}
      type="button"
      onClick={(e) => {
        const event = e.metaKey ? s.click(l(s.meta_key())) : s.click(l());
        // handle(next, onClick, event);
      }}
    >
      {label.value}
    </button>
  );
};

const Input: VC = ({ process, values: [props, value, next, onChange] }) => {
  // const handle = useStateCallback(process);
  if (value.tag !== "string" && value.tag !== "number") return null;

  const { debounce: db = 0, ...jsProps } = getProps(props);

  return (
    <input
      {...jsProps}
      defaultValue={value.value}
      // onChange={debounce(db, (e) => {
      //   handle(next, onChange, s.change(e.target.value));
      // })}
      // onFocus={() => {
      //   handle(next, onChange, s.focus());
      // }}
      // onBlur={() => {
      //   handle(next, onChange, s.blur());
      // }}
    />
  );
};

const Select: VC = ({
  process,
  values: [props, value, options, next, onChange],
}) => {
  ensure(value, "string");
  ensure(options, "box");

  // const handle = useStateCallback(process);
  return (
    <select
      {...getProps(props)}
      value={value.value}
      onChange={(e) => {
        // handle(next, onChange, s.change(e.target.value));
      }}
      onFocus={() => {
        // handle(next, onChange, s.focus());
      }}
      onBlur={() => {
        // handle(next, onChange, s.blur());
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
  process,
  values: [windowId, currentWindowId, onSelect, onBack, onForward, children],
}) => {
  ensure(windowId, "string");
  ensure(currentWindowId, "string");
  // const handle = useStateCallback(process);
  const isCurrent = windowId.value === currentWindowId.value;
  return (
    <div
      tabIndex={0}
      className={["AppWindow", isCurrent && "AppWindow--current"]
        .filter(Boolean)
        .join(" ")}
      onMouseDownCapture={() => {
        // if (!isCurrent) handle(__, onSelect, __);
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          // handle(__, onBack, __);
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          // handle(__, onForward, __);
        }
      }}
    >
      <Children process={process} children={children} />
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
  // Receive,
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
    this.process = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.process.error) {
      return (
        <div style={{ backgroundColor: "pink" }}>
          <div>{this.process.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Children({
  process,
  children,
}: {
  process: Process;
  children: Value;
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
      {(children.args as (Value & { tag: "box" })[]).map((arg, i) => (
        <Primitive key={i} process={process} id={arg.id} values={arg.args} />
      ))}
    </>
  );
}

export function Primitive({
  process,
  id,
  values,
}: {
  process: Process;
  id: string;
  values: Value[];
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <ErrorBoundary>
      <View process={process} id={id} values={values} />
    </ErrorBoundary>
  );
}
