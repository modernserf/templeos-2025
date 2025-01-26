import { FC } from "react";
import { State } from "./state";
import { Clause, FormatTextNode, Id, Rule } from "./schema";
import { filter } from "./iter";
import { k, R, v } from "./rule_builder";
import { useEventHandler } from "./event_source";
import "./view_primitive.css";

type View<Args extends unknown[]> = FC<{ state: State; args: Args }>;

// TODO: want to do non-hierarchichal layout
const Row: View<[Clause[]]> = ({ state, args: [children] }) => (
  <div className="Row">
    <Children state={state} ruleBody={children} />
  </div>
);

const Column: View<[Clause[]]> = ({ state, args: [children] }) => (
  <div className="Column">
    <Children state={state} ruleBody={children} />
  </div>
);

const AnyData: View<[unknown]> = ({ args: [value] }) => {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
};

const String: View<[string]> = ({ args: [value] }) => <div>{value}</div>;

const Button: View<[string, Rule]> = ({ state, args: [label, rule] }) => {
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      onClick={() => {
        handle(rule, []);
      }}
    >
      {label}
    </button>
  );
};

const Input: View<[string, Rule]> = ({ state, args: [value, rule] }) => {
  const handle = useEventHandler(state);
  return (
    <input
      value={value}
      onChange={(e) => {
        handle(rule, [e.target.value]);
      }}
    />
  );
};

const Option: View<[Id, string]> = ({ args: [id, label] }) => (
  <option value={id}>{label}</option>
);
const Select: View<[Id, Rule, Clause[]]> = ({
  state,
  args: [value, rule, items],
}) => {
  const handle = useEventHandler(state);
  return (
    <select
      value={value}
      onChange={(e) => {
        handle(rule, [e.target.value]);
      }}
    >
      <Children state={state} ruleBody={items} />
    </select>
  );
};

const qNewWindow = R("id", "view")
  .r("rule__newWindow", [v("id"), v("view")])
  .build();
const qPush = R("id", "view")
  .getContext("windowId", "windowId")
  .r("rule__push", [v("windowId"), v("id"), v("view")])
  .build();
const Link: View<[string, string, string]> = ({
  state,
  args: [label, id, target],
}) => {
  const view = null;
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      className="Link"
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          handle(qNewWindow, [id, view]);
        } else {
          handle(qPush, [id, view]);
        }
      }}
    >
      {label}
    </button>
  );
};

const IconView: View<[]> = () => (
  <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>
);

const qLink = R("label", "id").link("label", "id").build();

const TextView: View<[FormatTextNode[]]> = ({ state, args: [text] }) => (
  <>
    {text.map((node, i) => {
      switch (node.tag) {
        case "text":
          return <span key={i}>{node.text}</span>;
        case "link":
          return (
            <span key={i} className="TextView__Link">
              <Query
                state={state}
                rule={qLink}
                args={[node.text, node.params.id]}
              />
            </span>
          );
      }
    })}
  </>
);

const qRootView = R("id", "view") //
  .r("rule__call", [v("view"), v("id")])
  .build();
const qSelectWindow = R("windowId")
  .r("rule__selectWindow", [v("windowId")])
  .build();
const qBack = R("windowId")
  .r("rule__back", [v("windowId")])
  .build();
const qForward = R("windowId")
  .r("rule__forward", [v("windowId")])
  .build();
const qCloseWindow = R("windowId")
  .r("rule__closeWindow", [v("windowId")])
  .build();

const qViewMenu = R("windowId", "id", "view")
  .r("view__select", [
    v("view"),
    k(
      R("nextView")
        .get("windowId", "window__currentHistory", "h")
        .update("h", "history__view", "nextView")
        .build()
    ),
    k(
      R()
        .or(
          // views for type
          R()
            .get("id", "db__schema", "schema")
            .get("viewOption", "view__schema", "schema")
            .body(),
          // views for any type
          R().get("viewOption", "view__schema", k("schema__anyType")).body()
        )
        .get("viewOption", "file__name", "viewName")
        .r("view__option", [v("viewOption"), v("viewName")])
        .build().rule__body
    ),
  ])
  .build();

const Window: View<[string, string, string, string]> = ({
  state,
  args: [id, view, windowId, currentWindowId],
}) => {
  const handle = useEventHandler(state);
  const fileName = id;
  const isCurrent = windowId === currentWindowId;
  return (
    <div
      tabIndex={0}
      className={["AppWindow", isCurrent && "AppWindow--current"]
        .filter(Boolean)
        .join(" ")}
      onMouseDownCapture={() => {
        handle(qSelectWindow, [windowId]);
      }}
      onKeyDownCapture={(e) => {
        if (e.key == "[" && e.metaKey) {
          e.preventDefault();
          handle(qBack, [windowId]);
        }
        if (e.key == "]" && e.metaKey) {
          e.preventDefault();
          handle(qForward, [windowId]);
        }
      }}
    >
      <header className="AppWindow__header">
        <button
          className="AppWindow__closeButton"
          type="button"
          onClick={() => {
            handle(qCloseWindow, [windowId]);
          }}
        ></button>
        <h1 className="AppWindow__title">{fileName}</h1>
        <Query state={state} rule={qViewMenu} args={[windowId, id, view]} />
      </header>
      <Query state={state} rule={qRootView} args={[id, view]} />
    </div>
  );
};

export type ViewPrimitiveId = keyof typeof viewPrimitives;
const viewPrimitives = {
  Row,
  Column,
  AnyData,
  String,
  Button,
  Input,
  Select,
  Option,
  Link,
  IconView,
  TextView,
  Window,
};

function Children({ state, ruleBody }: { state: State; ruleBody: Clause[] }) {
  const views = Array.from(
    filter((res) => res.tag === "view", state.runRuleBody(ruleBody))
  );
  return (
    <>
      {views.map((view, i) => {
        const View = viewPrimitives[view.view] as View<unknown[]>;
        return <View key={i} args={view.args} state={view.state} />;
      })}
    </>
  );
}

export function Query({
  state,
  rule,
  args = [],
}: {
  state: State;
  rule: Rule;
  args?: unknown[];
}) {
  if (!rule) throw new Error();
  const views = Array.from(
    filter((res) => res.tag === "view", state.runRule(rule, args))
  );
  return (
    <>
      {views.map((view, i) => {
        const View = viewPrimitives[view.view] as View<unknown[]>;
        return <View key={i} args={view.args} state={view.state} />;
      })}
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
