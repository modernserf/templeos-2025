import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useEventHandler, useQuery } from "./state";
import { q, Query as TQuery } from "./query";
import { FormatTextNode } from "./view";
import { QueryNext, QueryState } from "./runtime";
import { k } from "./expr";
import { flatMap, take } from "./iter";

type ViewProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  children?: ReactNode;
  args: T;
  state: QueryState;
};

type Target = "current" | "new";

const tabContext = createContext("rootWindow");
export const TabProvider = tabContext.Provider;

// TODO: want to do non-hierarchichal layout
function Row({ children }: ViewProps) {
  return <div className="Row">{children}</div>;
}

function Column({ children }: ViewProps) {
  return <div className="Column">{children}</div>;
}

function AnyData({ args: { value } }: ViewProps<{ value: unknown }>) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function String({ args: { value } }: ViewProps<{ value: string }>) {
  return <div>{value}</div>;
}

function Button({
  args: { label, query },
  state,
}: ViewProps<{ label: string; query: TQuery }>) {
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      onClick={() => {
        handle(query, {});
      }}
    >
      {label}
    </button>
  );
}

function Input({
  args: { value, query },
  state,
}: ViewProps<{ value: string; query: TQuery }>) {
  const handle = useEventHandler(state);
  return (
    <input
      value={value}
      onChange={(e) => {
        handle(query, { [query.params[0]]: e.target.value });
      }}
    />
  );
}

const qNewWindow = q("id", "view", "data")
  .rule("rule__newWindow", { id: "id", view: "view", data: "data" })
  .build();
const qPush = q("windowId", "id", "view", "data")
  .rule("rule__push", {
    windowId: "windowId",
    id: "id",
    view: "view",
    data: "data",
  })
  .build();

function Link({
  args: { label, id, view, data, target = "current" },
  state,
}: ViewProps<{
  label: string;
  id: string;
  view?: string;
  data?: Record<string, string>;
  target?: Target;
}>) {
  const handle = useEventHandler(state);
  const windowId = useContext(tabContext);
  return (
    <button
      type="button"
      className="Link"
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          handle(qNewWindow, { id, view, data });
        } else {
          handle(qPush, { windowId, id, view, data });
        }
      }}
    >
      {label}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function IconView(_: ViewProps) {
  return <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>;
}

function TextView({
  state,
  args: { text },
}: ViewProps<{ text: FormatTextNode[] }>) {
  return (
    <>
      {text.map((node, i) => {
        switch (node.tag) {
          case "text":
            return <span key={i}>{node.text}</span>;
          case "link":
            return (
              <span key={i} className="TextView__Link">
                <Link
                  state={state}
                  args={{ ...node.params, label: node.text }}
                />
              </span>
            );
        }
      })}
    </>
  );
}

const allQuery = q() //
  .get("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description")
  .get("id", "db__schema", "schemaId")
  .get("schemaId", "file__name", "schemaName")
  .result()
  .build();

const rowQuery = q("id", "name", "description", "schemaId", "schemaName")
  .row((q) =>
    q.link("name", "id").string(k(":")).link("schemaName", "schemaId")
  )
  .string("description")
  .build();

const qReplace = q("data", "windowId")
  .rule("rule__replace", {
    id: k(undefined),
    view: k(undefined),
    data: "data",
    windowId: "windowId",
  })
  .build();

function OmniboxView({
  args: { data },
  state,
}: ViewProps<{ data: { omnibox?: string } }>) {
  const results = useQuery(state, allQuery);
  const handle = useEventHandler(state);
  const windowId = useContext(tabContext);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = data.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const filtered = Array.from(
    take(
      10,
      flatMap(function* (item) {
        if (item.tag === "result") {
          const { id, name, description } = item.value as {
            id: string;
            name: string;
            description: string;
          };
          if (
            re.test(id) ||
            re.test(name ?? "") ||
            re.test(description ?? "")
          ) {
            yield item.value;
          }
        }
      }, results)
    )
  );

  return (
    <div className="OmniboxView">
      <input
        className="OmniboxView__input"
        value={omnibox}
        ref={ref}
        onChange={(e) => {
          handle(qReplace, {
            windowId,
            data: { omnibox: e.target.value },
          });
        }}
      />
      <ul className="OmniboxView__list">
        {filtered.map((args) => (
          <li key={args.id as string} className="OmniboxView__listItem">
            <Query state={state} query={rowQuery} args={args} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const primitiveViews: Record<string, FC<ViewProps<any>>> = {
  Row,
  Column,
  AnyData,
  String,
  Button,
  Input,
  Link,
  IconView,
  TextView,
  OmniboxView,
};

function Primitive({
  primitive,
  args,
  state,
  children,
}: {
  primitive: string;
  args: Record<string, unknown>;
  state: QueryState;
  children: QueryNext[];
}) {
  const View = primitiveViews[primitive];
  return (
    <View state={state} args={args}>
      {children.map((child, i) =>
        child.tag === "viewPrimitive" ? <Primitive key={i} {...child} /> : null
      )}
    </View>
  );
}

export function Query({
  query,
  args,
  state,
}: {
  query: TQuery;
  args: Record<string, unknown>;
  state: QueryState;
}) {
  const res = Array.from(useQuery(state, query, args));
  return (
    <>
      {res.map((props, i) =>
        props.tag === "viewPrimitive" ? <Primitive key={i} {...props} /> : null
      )}
    </>
  );
}
