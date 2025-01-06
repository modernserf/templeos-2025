import { useEffect, useRef, useContext, createContext } from "react";
import {
  BrowseParams,
  actions,
  useDispatch,
  useQuery,
  Expr,
  TextNode,
  CardEl,
  useDB,
  useQueryAll,
} from "./state";
import "./App.css";
import { k, q } from "./db";

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
          dispatch(actions.newWindow, params);
        } else {
          dispatch(actions.push, { windowId, ...params });
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

const qFolder = q("id") //
  .get("id", "file__folderItems", "items");
function FolderListView({ id }: BrowseParams) {
  const { items } = useQuery(qFolder, { id })!;
  return (
    <ul>
      {((items as string[]) ?? []).map((id) => (
        <li key={id}>
          <FileLink id={id} />
        </li>
      ))}
    </ul>
  );
}

function FolderIconView({ id }: BrowseParams) {
  const { items } = useQuery(qFolder, { id })!;
  return (
    <ul style={{ display: "flex" }}>
      {((items as string[]) ?? []).map((id) => (
        <li key={id}>
          <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>
          <FileLink id={id} />
        </li>
      ))}
    </ul>
  );
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

const qTextContent = q("id") //
  .get("id", "text__content", "content");
function TextView({ id }: BrowseParams) {
  const { content } = useQuery(qTextContent, { id })!;
  return (
    <div>
      {((content as TextNode[]) ?? []).map((node, i) => {
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
    </div>
  );
}

function evalExpr(expr: Expr, scope: Record<string, unknown>): any {
  switch (expr.tag) {
    case "string":
      return expr.value;
    case "ident":
      return scope[expr.value];
    case "field":
      return evalExpr(expr.expr, scope)[expr.field];
  }
}

const qCardView = q("view") //
  .get("view", "view__cardElements", "els");
function CardView({ id, view, data }: BrowseParams) {
  const scope = { id, view, data };
  const { els } = useQuery(qCardView, { view })!;
  return (
    <div>
      {((els as CardEl[]) ?? []).map((el, i) => {
        switch (el.tag) {
          case "text":
            return <div key={i}>{evalExpr(el.expr, scope)}</div>;
          case "button":
            return (
              <Link key={i} params={{ id: "home" }}>
                {evalExpr(el.label, scope)}
              </Link>
            );
        }
      })}
    </div>
  );
}

const allQuery = q() //
  .all("id")
  .get("id", "file__name", "name")
  .get("id", "file__description", "description");

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

function OmniboxView({ data }: BrowseParams) {
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
          dispatch(actions.replace, {
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

const viewByName: Record<string, React.FC<BrowseParams>> = {
  TextView,
  DataView,
  CardView,
  OmniboxView,
  FolderListView,
  FolderIconView,
};

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

// FIXME: default value
const qView = q("activeView") //
  .get("activeView", "view__component", "componentName");

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
  const { componentName } = useQuery(qView, { activeView })!;

  const View = viewByName[componentName as string];

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          dispatch(actions.selectWindow, { windowId });
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            dispatch(actions.back, { windowId });
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            dispatch(actions.forward, { windowId });
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              dispatch(actions.closeWindow, { windowId });
            }}
          ></button>
          <h1 className="AppWindow__title">{fileName as string}</h1>
          <select
            className="AppWindow__viewMenu"
            value={activeView as string}
            onChange={(e) => {
              dispatch(actions.replace, {
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
        <View
          id={id as string}
          view={activeView as string}
          data={(data as Record<string, string>) ?? {}}
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
          dispatch(actions.back, { windowId: win?.id as string });
        }}
        disabled={!win?.back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.forward, { windowId: win?.id as string });
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
