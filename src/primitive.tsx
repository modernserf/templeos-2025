import { FC, ReactNode, useEffect, useRef } from "react";
import { useEventHandler, useQueryResult, useQueryView } from "./state";
import { q, Query as TQuery } from "./query";
import { FormatTextNode } from "./view";
import { QueryNext, QueryState } from "./runtime";
import { k, or } from "./expr";

type ViewProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  children?: ReactNode;
  args: T;
  state: QueryState;
};

type Target = "current" | "new";

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

function Select({
  state,
  children,
  args: { value, query },
}: ViewProps<{ value: string; query: TQuery }>) {
  const handle = useEventHandler(state);
  return (
    <select
      value={value}
      onChange={(e) => {
        handle(query, { [query.params[0]]: e.target.value });
      }}
    >
      {children}
    </select>
  );
}

function Option({
  args: { id, label },
}: ViewProps<{ id: string; label: string }>) {
  return <option value={id}>{label}</option>;
}

const qNewWindow = q("id", "view")
  .rule("rule__newWindow", { id: "id", view: "view" })
  .build();
const qPush = q("id", "view")
  .getContext("windowId", "windowId")
  .rule("rule__push", {
    windowId: "windowId",
    id: "id",
    view: "view",
  })
  .build();

function Link({
  args: { label, id, view, target = "current" },
  state,
}: ViewProps<{
  label: string;
  id: string;
  view?: string;
  // TODO
  // data?: Record<string, string>;
  target?: Target;
}>) {
  const handle = useEventHandler(state);
  return (
    <button
      type="button"
      className="Link"
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          handle(qNewWindow, { id, view });
        } else {
          handle(qPush, { id, view });
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const primitiveViews: Record<string, FC<ViewProps<any>>> = {
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
  const res = Array.from(useQueryView(state, query, args));
  return (
    <>
      {res.map((props, i) => (
        <Primitive key={i} {...props} />
      ))}
    </>
  );
}
