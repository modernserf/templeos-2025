import { Component, FC, ReactNode } from "react";
import { AnyStruct, Expr, List, printExpr, s, Struct } from "./expr";
import { Callback, State, View } from "./state";
import "./view_primitive.css";
import { useStateCallback, useEventHandler } from "./event_source";

type VC<Args extends Expr[]> = FC<{
  state: State;
  id: string;
  args: Args;
  callbacks: Callback[];
  children: ReactNode;
}>;

// TODO: want to do non-hierarchichal layout
const Row: VC<[]> = ({ children }) => <div className="Row">{children}</div>;
const Column: VC<[]> = ({ children }) => (
  <div className="Column">{children}</div>
);

const String: VC<[string]> = ({ args: [value] }) => <div>{value}</div>;

const Button: VC<[string, string]> = ({
  state,
  args: [label, className],
  callbacks: [onClick],
}) => {
  const handle = useStateCallback(state);
  return (
    <button
      className={className}
      type="button"
      onClick={(e) => {
        handle(onClick, s("click", Number(e.metaKey)));
      }}
    >
      {label}
    </button>
  );
};

const Input: VC<[string, string]> = ({
  state,
  args: [value, className],
  callbacks: [onChange],
}) => {
  const handle = useStateCallback(state);
  return (
    <input
      className={className}
      value={value}
      onChange={(e) => {
        handle(onChange, e.target.value);
      }}
    />
  );
};

type Option = Struct<"option", [string, string]>;

const Select: VC<[string, List<Option>]> = ({
  state,
  args: [value, options],
  callbacks: [onChange],
}) => {
  const handle = useStateCallback(state);
  return (
    <select
      value={value}
      onChange={(e) => {
        handle(onChange, e.target.value);
      }}
    >
      {options.args.map(({ args: [id, label] }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
};

const Icon: VC<[]> = () => (
  <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>
);

const WindowContainer: VC<[string, string]> = ({
  state,
  children,
  args: [windowId, currentWindowId],
}) => {
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
      {children}
    </div>
  );
};

const WindowBar: VC<[string, string, string, string]> = ({
  state,
  args: [windowId, id, view, fileName],
}) => {
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
      <Query state={state} clause={s("view__viewMenu", windowId, id, view)} />
    </header>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viewPrimitives: Record<string, VC<any>> = {
  Row,
  Column,
  String,
  Button,
  Select,
  Icon,
  Input,
  WindowBar,
  WindowContainer,
};

const DefaultRenderer: VC<Expr[]> = ({ id, args, children }) => {
  return (
    <div style={{ backgroundColor: "pink" }}>
      <pre>{printExpr(s(id, ...args))}</pre>
      <div style={{ marginLeft: "1rem" }}>{children}</div>
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

function Primitive({
  state,
  id,
  args,
  callbacks,
  children,
}: {
  state: State;
  id: string;
  args: Expr[];
  callbacks: Callback[];
  children?: View[];
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <ErrorBoundary>
      <View state={state} id={id} args={args} callbacks={callbacks}>
        {(children ?? []).map((child, i) => (
          <Primitive key={i} {...child} />
        ))}
      </View>
    </ErrorBoundary>
  );
}

export function Query({ state, clause }: { state: State; clause: AnyStruct }) {
  const res = Array.from(state.render(clause));
  return (
    <>
      {res.map((view, i) => (
        <Primitive key={i} {...view} />
      ))}
    </>
  );
}
