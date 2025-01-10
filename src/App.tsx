import { useEffect, useRef, useContext, createContext } from "react";
import {
  BrowseParams,
  useDispatch,
  useQuery,
  useDB,
  useQueryAll,
} from "./state";
import "./App.css";
import { q, Query } from "./db";
import { getVar, k, Scope } from "./expr";
import { FormatTextNode, ViewElement } from "./view";

const tabContext = createContext("rootWindow");
const TabProvider = tabContext.Provider;

type Target = "current" | "new";

function Link({
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
function FileLink({ id, target }: { id: string; target?: Target }) {
  const { fileName } = useQuery(qFileLink, { id })!;
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {(fileName as string) ?? id}
    </Link>
  );
}

function IconView() {
  return <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>;
}

const qDataViewField = q("id") //
  .get("id", "field__refType", "refType");
function DataViewField({ id, value }: { id: string; value: unknown }) {
  const { refType } = useQuery(qDataViewField, { id })!;

  return refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

function DataView({ id }: BrowseParams) {
  const { data, index } = useDB().getDataView(id);
  const indexFields = Object.entries(index ?? {});
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
        {Object.entries(data ?? {}).map(([key, value]) => (
          <tr key={key}>
            <td>
              <FileLink id={key} />
            </td>
            <td>
              <DataViewField id={key} value={value} />
            </td>
          </tr>
        ))}
        {indexFields.length > 0 ? (
          <tr>
            <th colSpan={2}>Referenced by</th>
          </tr>
        ) : null}
        {indexFields.flatMap(([key, values]) => {
          return [...values].map((value, i) => (
            <tr key={`${key} ${value}`}>
              <td>{i === 0 ? <FileLink id={key} /> : null}</td>
              <td>
                <FileLink id={value} />
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
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
  .all("id")
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

function PrimitiveString({ value }: { value: string }) {
  return <div>{value}</div>;
}

function PrimitiveLink({
  label,
  id,
  view,
  data,
}: { label: string } & BrowseParams) {
  return <Link params={{ id, view, data }}>{label}</Link>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const primitiveViews: Record<string, React.FC<any>> = {
  PrimitiveLink,
  PrimitiveString,
  IconView,
  TextView,
  DataView,
  OmniboxView,
};

const qView = q("view") //
  .get("view", "view__query", "query")
  .get("view", "view__elements", "els")
  .get("view", "view__primitive", "primitive");
function SubView({ view, args }: { view: string; args: Scope }) {
  const { els, query, primitive } = useQuery(qView, { view })!;
  const result = useQueryAll((query as Query) ?? q(), args);

  if (primitive) {
    const View = primitiveViews[primitive as string];
    return <View {...args} />;
  }
  return (
    <>
      {[...result].map((scope, i) => (
        <div key={i}>
          {((els as ViewElement[]) ?? []).map((el, i) => (
            <SubView
              key={i}
              view={getVar(scope, el.view)}
              args={Object.fromEntries(
                Object.entries(el.args).map(([k, v]) => [k, getVar(scope, v)])
              )}
            />
          ))}
        </div>
      ))}
    </>
  );
}

const qAppWindow = q("windowId")
  .get("windowId", "window__currentHistory", "historyId")
  .get("historyId", "history__data", "data")
  .get("historyId", "history__location", "id")
  .get("historyId", "history__view", "viewId")
  .get("id", "file__name", "fileName");

const qViewsForType = q("id")
  .get("id", "db__schema", "schema")
  .index("view", "view__schema", "schema")
  .get("view", "file__name", "viewName");

const qViewsForAnyType = q()
  .index("view", "view__schema", k("schema__anyType"))
  .get("view", "file__name", "viewName");

function AppWindow({
  windowId,
  isCurrent,
}: {
  windowId: string;
  isCurrent: boolean;
}) {
  const dispatch = useDispatch();
  const { data, id, viewId, fileName } = useQuery(qAppWindow, { windowId })!;

  const viewers = [
    ...useQueryAll(qViewsForType, { id }),
    ...useQueryAll(qViewsForAnyType),
  ];

  const activeView = (viewId as string) || viewers[0].view;

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          dispatch("selectWindow", { windowId });
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            dispatch("back", { windowId });
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            dispatch("forward", { windowId });
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              dispatch("closeWindow", { windowId });
            }}
          ></button>
          <h1 className="AppWindow__title">{fileName as string}</h1>
          <select
            className="AppWindow__viewMenu"
            value={activeView as string}
            onChange={(e) => {
              dispatch("replace", {
                windowId,
                view: e.target.value,
              });
            }}
          >
            {viewers.map((v) => (
              <option key={v.view as string} value={v.view as string}>
                {(v.viewName as string) ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <SubView
          view={activeView as string}
          args={{ id, view: activeView, data: data ?? {} }}
        />
      </div>
    </TabProvider>
  );
}

const qAppMenu = q()
  .get(k("browser"), "browser__currentWindow", "id")
  .get("id", "window__currentHistory", "currentHistory")
  .get("currentHistory", "history__back", "back")
  .get("currentHistory", "history__forward", "forward");

function AppMenu() {
  const dispatch = useDispatch();
  const win = useQuery(qAppMenu);

  return (
    <nav>
      <button
        type="button"
        onClick={() => {
          dispatch("back", { windowId: win?.id as string });
        }}
        disabled={!win?.back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch("forward", { windowId: win?.id as string });
        }}
        disabled={!win?.forward}
      >
        Forward
      </button>
      <FileLink id="home" target="new" />
      <FileLink id="omnibox" target="new" />
    </nav>
  );
}

const qApp = q()
  .get(k("browser"), "browser__currentWindow", "currentWindow")
  .index("id", "db__schema", k("schema__window"));

function App() {
  const windows = useQueryAll(qApp)!;
  return (
    <>
      <AppMenu />
      {[...windows].map(({ id, currentWindow }) => (
        <AppWindow
          key={id as string}
          windowId={id as string}
          isCurrent={currentWindow === id}
        />
      ))}
    </>
  );
}

export default App;
