import { FC, ReactNode } from "react";
import { __, AnyStruct, Expr, List, printExpr, s, v } from "./expr";
import { State, View } from "./state3";
import "./view_primitive.css";
import { useEventHandler } from "./event_source";
import { FormatText } from "./data3";

type VC<Args extends Expr[]> = FC<{
  state: State;
  id: string;
  args: Args;
  children: ReactNode;
}>;

// TODO: want to do non-hierarchichal layout
const Row: VC<[]> = ({ children }) => <div className="Row">{children}</div>;
const Column: VC<[]> = ({ children }) => (
  <div className="Column">{children}</div>
);

const AnyData: VC<[Expr]> = ({ args: [value] }) => {
  return <pre>{printExpr(value)}</pre>;
};

const String: VC<[string]> = ({ args: [value] }) => <div>{value}</div>;

const Button: VC<[string, Expr]> = ({ state, args: [label, onClick] }) => {
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      onClick={() => {
        handle(onClick);
        // handle(rule, []);
      }}
    >
      {label}
    </button>
  );
};

const Option: VC<[string, string]> = ({ args: [id, label] }) => (
  <option value={id}>{label}</option>
);
const Select: VC<[string, Expr, Expr]> = ({
  state,
  args: [value, event, onChange],
  children,
}) => {
  const handle = useEventHandler(state);
  return (
    <select
      value={value}
      onChange={(e) => {
        handle(s(",", s("=", event, e.target.value), onChange));
      }}
    >
      {children}
    </select>
  );
};

const Link: VC<[string, string, string]> = ({
  state,
  args: [label, id, target],
}) => {
  // const view = null;
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      className="Link"
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          handle(s("rule__newWindow", id, __));
          // handle(qNewWindow, [id, view]);
        } else {
          handle(
            s(
              ",",
              s("get_context", "window_id", v.window),
              s("rule__push", v.window, id, __)
            )
          );
          // handle(qPush, [id, view]);
        }
      }}
    >
      {label}
    </button>
  );
};

const Text: VC<[List<FormatText>]> = ({ state, args: [text] }) => (
  <>
    {text.args.map((node, i) => {
      switch (typeof node) {
        case "string":
          return <span key={i}>{node}</span>;
        case "object":
          return (
            <span key={i} className="TextView__Link">
              <Query
                state={state}
                clause={s("view", s("Link", ...node.args))}
              />
            </span>
          );
      }
    })}
  </>
);

const Window: VC<[string, string, string, string, string]> = ({
  state,
  args: [id, view, windowId, currentWindowId, fileName],
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
        handle(s("rule__selectWindow", windowId));
        // handle(qSelectWindow, [windowId]);
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          handle(s("rule__back", windowId));
          // handle(qBack, [windowId]);
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          handle(s("rule__forward", windowId));
          // handle(qForward, [windowId]);
        }
      }}
    >
      <header className="AppWindow__header">
        <button
          className="AppWindow__closeButton"
          type="button"
          onClick={() => {
            handle(s("rule__closeWindow", windowId));
          }}
        ></button>
        <h1 className="AppWindow__title">{fileName}</h1>

        <Query state={state} clause={s("view__viewMenu", windowId, id, view)} />
      </header>
      <Query state={state} clause={s(view, id)} />
    </div>
  );
};

const viewPrimitives: Record<string, VC<any>> = {
  Row,
  Column,
  AnyData,
  String,
  Button,
  Option,
  Select,
  Link,
  Text,
  Window,
};

const DefaultRenderer: VC<Expr[]> = ({ id, args, children }) => {
  return (
    <div style={{ backgroundColor: "pink" }}>
      <pre>{printExpr(s(id, ...args))}</pre>
      <div style={{ marginLeft: "1rem" }}>{children}</div>
    </div>
  );
};

function Primitive({
  state,
  id,
  args,
  children,
}: {
  state: State;
  id: string;
  args: Expr[];
  children?: View[];
}) {
  const View = viewPrimitives[id] ?? DefaultRenderer;
  return (
    <View state={state} id={id} args={args}>
      {(children ?? []).map((child, i) => (
        <Primitive key={i} {...child} />
      ))}
    </View>
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

/*


const qRows = q() //
  .limit(10)
  .rule("rule__getData", { field: k("data__omnibox"), data: "data" })
  .get("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description")
  .get("id", "db__schema", "schemaId")
  .get("schemaId", "file__name", "schemaName")
  // TODO: also match description
  .matchString(or("data", k("")), "name")
  .row((qq) =>
    qq //
      .link("name", "id")
      .string(k(":"))
      .link("schemaName", "schemaId")
  )
  .string("description")
  // TODO: real layout instead of these dividers
  .string(k("--------"))
  .build();

const qData = q()
  .rule("rule__getData", { field: k("data__omnibox"), data: "data" })
  .build();

const qReplace = q("data")
  .rule("rule__setData", { field: k("data__omnibox"), data: "data" })
  .build();

function OmniboxView({ state }: ViewProps) {
  const handle = useEventHandler(state);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const [{ data }] = Array.from(useQueryResult<{ data: string }>(state, qData));
  const omnibox = data ?? "";
  return (
    <div className="OmniboxView">
      <input
        className="OmniboxView__input"
        value={omnibox}
        ref={ref}
        onChange={(e) => {
          handle(qReplace, { data: e.target.value });
        }}
      />
      <Query state={state} query={qRows} args={{}} />
    </div>
  );
}

*/
