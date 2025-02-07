import { Component, FC, ReactNode, useEffect, useMemo, useState } from "react";
import { AnyStruct, s } from "./expr";
import { k, printFact, State, StateNext, sv, Value, View } from "./state";
import "./view_primitive.css";
import { useStateCallback, useEventHandler } from "./event_source";
import { reduce } from "./iter";

type VC = FC<{
  state: State;
  id: string;
  values: Value[];
}>;

const Spacer: VC = ({ state, values: [space] }) => {
  return (
    <div className="Spacer" style={{ flexBasis: state.resolveString(space) }} />
  );
};

const Html: VC = ({ state, values: [tag, props, children] }) => {
  const El = state.resolveString(tag);
  return (
    <El>
      <Children state={state} children={children} />
    </El>
  );
};

const Row: VC = ({ state, values: [children] }) => (
  <div className="Row">
    <Children state={state} children={children} />
  </div>
);
const Column: VC = ({ state, values: [children] }) => (
  <div className="Column">
    <Children state={state} children={children} />
  </div>
);

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

const String: VC = ({ values: [value] }) => (
  <span className="String">{value.value}</span>
);

const Button: VC = ({ state, values: [label, className, next, onClick] }) => {
  const handle = useStateCallback(state);
  return (
    <button
      className={state.resolveString(className)}
      type="button"
      onClick={(e) => {
        handle(next, onClick, s("click", Number(e.metaKey)));
      }}
    >
      {state.resolveString(label)}
    </button>
  );
};

const Input: VC = ({ state, values: [value, className, next, onChange] }) => {
  const handle = useStateCallback(state);
  return (
    <input
      className={state.resolveString(className)}
      value={value.value}
      onChange={(e) => {
        handle(next, onChange, e.target.value);
      }}
    />
  );
};

const Select: VC = ({ state, values: [value, options, next, onChange] }) => {
  const handle = useStateCallback(state);
  return (
    <select
      value={state.resolveString(value)}
      onChange={(e) => {
        handle(next, onChange, e.target.value);
      }}
    >
      {state.resolveStruct(options).args.map((opt) => {
        const struct = state.resolveStruct(opt);
        const id = state.resolveString(struct.args[0]);
        const label = state.resolveString(struct.args[1]);
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
  values: [windowId_, currentWindowId_, children],
}) => {
  const windowId = state.resolveString(windowId_);
  const currentWindowId = state.resolveString(currentWindowId_);
  const handle = useEventHandler(state);
  const isCurrent = windowId === currentWindowId;
  return (
    <div
      tabIndex={0}
      className={["AppWindow", isCurrent && "AppWindow--current"]
        .filter(Boolean)
        .join(" ")}
      onMouseDownCapture={() => {
        if (!isCurrent) handle(s("on__selectWindow", windowId));
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          handle(s("on__back", windowId));
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          handle(s("on__forward", windowId));
        }
      }}
    >
      <Children state={state} children={children} />
    </div>
  );
};

const WindowBar: VC = ({ state, values }) => {
  const [windowId, id, view, fileName] = values.map((val) =>
    state.resolveString(val)
  );

  const handle = useEventHandler(state);
  return (
    <header className="AppWindow__header">
      <button
        className="AppWindow__closeButton"
        type="button"
        onClick={() => {
          handle(s("on__closeWindow", windowId));
        }}
      ></button>
      <h1 className="AppWindow__title">{fileName}</h1>
      <Query state={state} clause={s("view__view_menu", windowId, id, view)} />
    </header>
  );
};

const viewPrimitives: Record<string, VC> = {
  Html,
  Spacer,
  Row,
  Column,
  LocalState,
  String,
  Button,
  Select,
  Icon,
  Input,
  WindowBar,
  WindowContainer,
};

const DefaultRenderer: VC = ({ id, values }) => {
  return (
    <div style={{ backgroundColor: "pink" }}>
      <pre>{printFact({ tag: "struct", id, args: values })}</pre>
    </div>
  );
};

class ErrorBoundary extends Component<
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
  const views = reduce<View[], StateNext>(
    [],
    (children, res) => {
      if (res.tag === "view") children.push(res);
      return children;
    },
    state.eval(children)
  );
  return (
    <>
      {views.map((view, i) => (
        <Primitive
          key={i}
          state={view.state}
          id={view.id}
          values={view.values}
        />
      ))}
    </>
  );
}

function Primitive({
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

export function Query({ state, clause }: { state: State; clause: AnyStruct }) {
  try {
    const res = Array.from(state.render(clause));
    return (
      <>
        {res.map((view, i) => (
          <Primitive key={i} {...view} />
        ))}
      </>
    );
  } catch (e) {
    console.log(e);
    return <pre>{(e as Error).message}</pre>;
  }
}
