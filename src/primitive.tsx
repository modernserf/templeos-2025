import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import {
  BrowseParams,
  useDispatch,
  useQueryAll,
  useRender,
  useUpdate,
} from "./state";
import { q } from "./query";
import { FormatTextNode } from "./view";
import { QueryResult } from "./runtime";
import { k } from "./expr";

type Target = "current" | "new";

const tabContext = createContext("rootWindow");
export const TabProvider = tabContext.Provider;

// TODO: want to do non-hierarchichal layout
function Row({ children }: { children: ReactNode }) {
  return <div className="Row">{children}</div>;
}

function Column({ children }: { children: ReactNode }) {
  return <div className="Column">{children}</div>;
}

function AnyData({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function String({ value }: { value: string }) {
  return <div>{value}</div>;
}

function Button({ label, query, scope }: { label: string }) {
  const update = useUpdate();
  return (
    <button
      type="button"
      onClick={() => {
        update(query, scope);
      }}
    >
      {label}
    </button>
  );
}

export function Link({
  label,
  id,
  view,
  data,
  target = "current",
}: { label: string; target?: Target } & BrowseParams) {
  const dispatch = useDispatch();
  const windowId = useContext(tabContext);
  return (
    <button
      type="button"
      className="Link"
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          dispatch("rule__newWindow", { id, view, data });
        } else {
          dispatch("rule__push", { windowId, id, view, data });
        }
      }}
    >
      {label}
    </button>
  );
}

function IconView() {
  return <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>;
}

function TextView({ text }: { text: FormatTextNode[] }) {
  return (
    <>
      {text.map((node, i) => {
        switch (node.tag) {
          case "text":
            return <span key={i}>{node.text}</span>;
          case "link":
            return (
              <span key={i} className="TextView__Link">
                <Link {...node.params} label={node.text} />
              </span>
            );
        }
      })}
    </>
  );
}

// TODO: put these into DB ("where" and "limit" respectively)
function* filter<T>(f: (t: T) => boolean, iter: Iterable<T>) {
  for (const item of iter) {
    if (f(item)) {
      yield item;
    }
  }
}

function* take<T>(count: number, iter: Iterable<T>) {
  let i = 0;
  for (const item of iter) {
    if (i < count) {
      i++;
      yield item;
    }
  }
}

const allQuery = q() //
  .get("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description")
  .get("id", "db__schema", "schemaId")
  .get("schemaId", "file__name", "schemaName")
  .build();

const rowQuery = q("id", "name", "description", "schemaId", "schemaName")
  .row((q) =>
    q.link("name", "id").string(k(":")).link("schemaName", "schemaId")
  )
  .string("description")
  .build();

function OmniboxView(props: BrowseParams) {
  const { data } = props;
  const results = useQueryAll(allQuery);
  const dispatch = useDispatch();
  const windowId = useContext(tabContext);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = data!.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const filtered = take(
    10,
    filter(
      ({ id, name, description }) =>
        re.test(id as string) ||
        re.test((name as string) ?? "") ||
        re.test((description as string) ?? ""),
      results
    )
  );

  return (
    <div className="OmniboxView">
      <input
        className="OmniboxView__input"
        value={omnibox}
        ref={ref}
        onChange={(e) => {
          dispatch("rule__replace", {
            windowId,
            data: { omnibox: e.target.value },
          });
        }}
      />
      <ul className="OmniboxView__list">
        {[...filtered].map((args) => (
          <li key={args.id as string} className="OmniboxView__listItem">
            <Query query={rowQuery} args={args} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const primitiveViews = {
  Row,
  Column,
  AnyData,
  String,
  Button,
  Link,
  IconView,
  TextView,
  OmniboxView,
};

function Primitive({
  primitive,
  args,
  scope,
  children,
}: {
  primitive: keyof typeof primitiveViews;
  args: Record<string, any>;
  scope: Record<string, any>;
  children: (QueryResult & { tag: "viewPrimitive" })[];
}) {
  const View = primitiveViews[primitive];
  return (
    <View scope={scope} {...args}>
      {children.map((child, i) => (
        <Primitive key={i} {...child} />
      ))}
    </View>
  );
}

export function Query({ query, args }) {
  const res = Array.from(useRender(query, args));
  return (
    <>
      {res.map((props, i) => (
        <Primitive key={i} {...props} />
      ))}
    </>
  );
}
