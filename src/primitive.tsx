import { createContext, useContext, useEffect, useRef } from "react";
import { BrowseParams, useDispatch, useQuery, useQueryAll } from "./state";
import { q } from "./db";
import { k, v } from "./expr";
import { FormatTextNode } from "./view";

type Target = "current" | "new";

const tabContext = createContext("rootWindow");
export const TabProvider = tabContext.Provider;

export function Link({
  params,
  children,
  target = "current",
  className,
}: {
  params: BrowseParams;
  children: React.ReactNode;
  target?: Target;
  className?: string;
}) {
  const dispatch = useDispatch();
  const windowId = useContext(tabContext);
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          dispatch("newWindow", params);
        } else {
          dispatch("push", { windowId, ...params });
        }
      }}
    >
      {children}
    </button>
  );
}

const qFileLink = q("id") //
  .get("id", "file__name", "fileName");
export function FileLink({ id, target }: { id: string; target?: Target }) {
  const { fileName } = useQuery(qFileLink, { id })!;
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {(fileName as string) ?? id}
    </Link>
  );
}

export function IconView() {
  return <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>;
}

const qDataViewField = q("id") //
  .get("id", "field__refType", "refType");
export function DataViewField({ id, value }: { id: string; value: unknown }) {
  const { refType } = useQuery(qDataViewField, { id })!;

  return refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

const qAllFields = q("id")
  .get("id", "fieldId")
  .get("id", v("fieldId"), "value");

const qAllRefs = q("id")
  .get("fieldId", "field__index", k("ref"))
  .get("refId", v("fieldId"), "id");

export function DataView({ id }: BrowseParams) {
  const allFields = [...useQueryAll(qAllFields, { id })];
  const allRefs = [...useQueryAll(qAllRefs, { id })];
  return (
    <table>
      <tbody>
        <tr>
          <td>id</td>
          <td>{id}</td>
        </tr>
        <tr>
          <th colSpan={2}>Fields</th>
        </tr>
        {allFields.map(({ fieldId, value }) => (
          <tr key={fieldId as string}>
            <td>
              <FileLink id={fieldId as string} />
            </td>
            <td>
              <DataViewField id={fieldId as string} value={value} />
            </td>
          </tr>
        ))}
        <tr>
          <th>Field</th>
          <th>Refernced By</th>
        </tr>
        {allRefs.map(({ fieldId, refId }) => (
          <tr key={`${fieldId} ${refId}`}>
            <td>{<FileLink id={fieldId as string} />}</td>
            <td>
              <FileLink id={refId as string} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
              <Link key={i} params={node.params} className="TextView__link">
                {node.text}
              </Link>
            );
        }
      })}
    </>
  );
}

const allQuery = q() //
  .get("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description");

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
          dispatch("replace", {
            windowId,
            data: { omnibox: e.target.value },
          });
        }}
      />
      <ul className="OmniboxView__list">
        {[...filtered].map(({ id, description }) => (
          <li key={id as string} className="OmniboxView__listItem">
            <FileLink id={id as string} /> <span>{description as string}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PrimitiveString({ value }: { value: string }) {
  return <div>{value}</div>;
}

export function PrimitiveLink({
  label,
  id,
  view,
  data,
}: { label: string } & BrowseParams) {
  return <Link params={{ id, view, data }}>{label}</Link>;
}
