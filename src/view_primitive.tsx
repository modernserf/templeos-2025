import { Component, FC, ReactNode, useEffect, useMemo, useState } from "react";
import { __, l, s } from "./expr";
import { k, printFact, State, sv, Value } from "./state";
import "./view_primitive.css";
import { useStateCallback } from "./event_source";
import { debounce } from "./util";

type VC = FC<{
  state: State;
  id: string;
  values: Value[];
}>;

type Props = {
  className: string;
  style: Record<string, unknown>;
  placeholder?: string;
  debounce?: number;
};

function getProps(state: State, props: Value): Props {
  const out: Record<string, unknown> = {};
  const classList: string[] = [];
  const style: Record<string, string> = {};
  for (const arg of state.resolveStruct(props).args) {
    const { id, args } = state.resolveStruct(arg);
    switch (id) {
      case "class":
        classList.push(state.resolveString(args[0]));
        break;
      case "style":
        style[state.resolveString(args[0])] = state.resolveString(args[1]);
        break;
      case "placeholder":
        out.placeholder = state.resolveString(args[0]);
        break;
      case "debounce":
        out.debounce = state.resolveNumber(args[0]);
    }
  }
  return { ...out, className: classList.join(" "), style };
}

const Html: VC = ({ state, values: [tag, props, children] }) => {
  const El = state.resolveString(tag);
  return (
    <El {...getProps(state, props)}>
      <Children state={state} children={children} />
    </El>
  );
};

const LocalState: VC = ({
  state,
  values: [init_value, value_var, next_var, on_change, children],
}) => {
  const id = useMemo(() => crypto.randomUUID(), []);
  const [currentValue, setValue] = useState(init_value);
  useEffect(() => {
    // TODO: only get this component's events
    state.eventSource.addEventListener((res) => {
      if (res.id === id) setValue(res.value);
    });
  }, [state, next_var, on_change, id]);

  const localState = state
    .unify(value_var, currentValue)
    ?.unify(on_change, sv("dispatch", k(id), next_var));
  if (!localState) throw new Error("cannot unify local state value");

  return <Children state={localState} children={children} />;
};

const String: VC = ({ values: [value] }) => value.value;

const Button: VC = ({ state, values: [props, label, next, onClick] }) => {
  const handle = useStateCallback(state);
  return (
    <button
      {...getProps(state, props)}
      type="button"
      onClick={(e) => {
        const event = e.metaKey ? s.click(l(s.meta_key())) : s.click(l());
        handle(next, onClick, event);
      }}
    >
      {state.resolveString(label)}
    </button>
  );
};

const Input: VC = ({ state, values: [props, value_, next, onChange] }) => {
  const handle = useStateCallback(state);
  const value = value_.value as string;
  const { debounce: db = 0, ...jsProps } = getProps(state, props);

  return (
    <input
      {...jsProps}
      defaultValue={value}
      onChange={debounce(db, (e) => {
        handle(next, onChange, s.change(e.target.value));
      })}
      onFocus={() => {
        handle(next, onChange, s.focus());
      }}
      onBlur={() => {
        handle(next, onChange, s.blur());
      }}
    />
  );
};

const Select: VC = ({
  state,
  values: [props, value, options, next, onChange],
}) => {
  const handle = useStateCallback(state);
  return (
    <select
      {...getProps(state, props)}
      value={state.resolveString(value)}
      onChange={(e) => {
        handle(next, onChange, s.change(e.target.value));
      }}
      onFocus={() => {
        handle(next, onChange, s.focus());
      }}
      onBlur={() => {
        handle(next, onChange, s.blur());
      }}
    >
      {state.resolveStruct(options).args.map((opt) => {
        const box = state.resolveStruct(opt);
        const id = state.resolveString(box.args[0]);
        const label = state.resolveString(box.args[1]);
        return (
          <option key={id} value={id}>
            {label}
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
  state,
  values: [windowId_, currentWindowId_, onSelect, onBack, onForward, children],
}) => {
  const windowId = state.resolveString(windowId_);
  const currentWindowId = state.resolveString(currentWindowId_);
  const handle = useStateCallback(state);
  const isCurrent = windowId === currentWindowId;
  return (
    <div
      tabIndex={0}
      className={["AppWindow", isCurrent && "AppWindow--current"]
        .filter(Boolean)
        .join(" ")}
      onMouseDownCapture={() => {
        if (!isCurrent) handle(__, onSelect, __);
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          handle(__, onBack, __);
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          handle(__, onForward, __);
        }
      }}
    >
      <Children state={state} children={children} />
    </div>
  );
};

const viewPrimitives: Record<string, VC> = {
  Html,
  LocalState,
  String,
  Button,
  Select,
  Icon,
  Input,
  WindowContainer,
};

const DefaultRenderer: VC = ({ id, values }) => {
  return (
    <div style={{ backgroundColor: "pink" }}>
      <pre>{printFact({ tag: "box", id, args: values ?? [] })}</pre>
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

function Children({ state, children }: { state: State; children: Value }) {
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
        <Primitive key={i} state={state} id={arg.id} values={arg.args} />
      ))}
    </>
  );
}

export function Primitive({
  state,
  id,
  values,
}: {
  state: State;
  id: string;
  values: Value[];
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <ErrorBoundary>
      <View state={state} id={id} values={values} />
    </ErrorBoundary>
  );
}
