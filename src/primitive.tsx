import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { BrowseParams, useDispatch, useQueryAll, useUpdate } from "./state";
import { q } from "./query";
import { FormatTextNode } from "./view";

type Target = "current" | "new";

const tabContext = createContext("rootWindow");
export const TabProvider = tabContext.Provider;

// TODO: want to do non-hierarchichal layout
export function Row({ children }: { children: ReactNode }) {
  return <div className="Row">{children}</div>;
}

export function Column({ children }: { children: ReactNode }) {
  return <div className="Column">{children}</div>;
}

export function AnyData({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function String({ value }: { value: string }) {
  return <div>{value}</div>;
}

export function Button({ label, query, scope }: { label: string }) {
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

export function IconView() {
  return <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>;
}

export function TextView({ text }: { text: FormatTextNode[] }) {
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

const allQuery = q() //
  .get("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description")
  .get("id", "db__schema", "schemaId")
  .get("schemaId", "file__name", "schemaName")
  .build();

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

export function OmniboxView(props: BrowseParams) {
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
        {[...filtered].map(
          ({ id, name, description, schemaId, schemaName }) => (
            <li key={id as string} className="OmniboxView__listItem">
              <span className="Row">
                <Link id={id as string} label={name as string} />
                {schemaId && (
                  <>
                    <span>:</span>
                    <Link
                      id={schemaId as string}
                      label={schemaName as string}
                    />
                  </>
                )}
              </span>
              <span>{description as string}</span>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
