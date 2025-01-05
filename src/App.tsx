import { useEffect, useRef, useContext, createContext } from "react";
import {
  BrowseParams,
  Rec,
  useDB,
  actions,
  selectors,
  useDispatch,
  useQuery,
  QueryBuilder,
  Expr,
  TextNode,
  CardEl,
} from "./state";
import "./App.css";

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
          dispatch(actions.newWindow, { params });
        } else {
          dispatch(actions.push, { params, windowId });
        }
      }}
    >
      {children}
    </button>
  );
}

const qFileLink = new QueryBuilder(["id"]) //
  .q("id", "file__name", "fileName");

function FileLink({ id, target }: { id: string; target?: Target }) {
  const { fileName } = useQuery(qFileLink, { id })!;
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {(fileName as string) ?? id}
    </Link>
  );
}

const qFolder = new QueryBuilder(["id"]).q("id", "file__folderItems", "items");
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

const qDataViewField = new QueryBuilder(["id"]) //
  .q("id", "field__refType", "refType");

function DataViewField({ id, value }: { id: string; value: unknown }) {
  const { refType } = useQuery(qDataViewField, { id })!;

  return refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

const qDataViewRecord = new QueryBuilder(["id"]) //
  .q("id", "rec");
function DataView({ id }: BrowseParams) {
  const indexFields = Object.entries(useDB().index[id!] ?? {});
  const { rec } = useQuery(qDataViewRecord, { id })!;

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
        {Object.entries(rec as Rec).map(([key, value]) => (
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

const qTextContent = new QueryBuilder(["id"]) //
  .q("id", "text__content", "content");
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

const qCardView = new QueryBuilder(["view"]) //
  .q("view", "view__cardElements", "els");
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

function OmniboxView({ data }: BrowseParams) {
  const db = useDB();
  const windowId = useContext(tabContext);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = data!.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const results = Object.entries(db.data).filter(
    ([key, value]) =>
      re.test(key) ||
      re.test(value.file__name ?? "") ||
      re.test(value.file__description ?? "")
  );

  return (
    <div className="OmniboxView">
      <input
        className="OmniboxView__input"
        value={omnibox}
        ref={ref}
        onChange={(e) => {
          actions.replace(db, {
            windowId,
            params: { data: { omnibox: e.target.value } },
          });
        }}
      />
      <ul className="OmniboxView__list">
        {results.map(([key, value]) => (
          <li key={key} className="OmniboxView__listItem">
            <FileLink id={key} /> <span>{value.file__description}</span>
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

const qAppWindow = new QueryBuilder(["windowId"])
  .q("windowId", "window__currentHistory", "historyId")
  .q("historyId", "history__data", "data")
  .q("historyId", "history__location", "id")
  .q("historyId", "history__view", "viewId");

function AppWindow({
  windowId,
  isCurrent,
}: {
  windowId: string;
  isCurrent: boolean;
}) {
  const db = useDB();
  const { data, id, viewId } = useQuery(qAppWindow, { windowId })!;

  const card = db.data[id as string] ?? db.data.notFound;
  const viewersForType = selectors.viewersForType(db, card.db__schema!);

  const activeView = (viewId as string) || viewersForType[0] || "view__anyType";

  const view = db.data[activeView];

  const View = viewByName[view.view__component!];
  const viewersForAnyType = selectors.viewersForAnyType(db);

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          actions.selectWindow(db, { windowId });
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            actions.back(db, { windowId });
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            actions.forward(db, { windowId });
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              actions.closeWindow(db, { windowId });
            }}
          ></button>
          <h1 className="AppWindow__title">{card.file__name}</h1>
          <select
            className="AppWindow__viewMenu"
            value={activeView}
            onChange={(e) => {
              actions.replace(db, {
                windowId,
                params: { view: e.target.value },
              });
            }}
          >
            {viewersForType.concat(viewersForAnyType).map((viewId) => (
              <option key={viewId} value={viewId}>
                {db.data[viewId].file__name ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <View
          id={id as string}
          view={activeView}
          data={(data as Record<string, string>) ?? {}}
        />
      </div>
    </TabProvider>
  );
}

const qAppMenu = new QueryBuilder(["browser"])
  .q("browser", "browser__currentWindow", "currentWindow")
  .q("currentWindow", "window__currentHistory", "currentHistory")
  .q("currentHistory", "history__back", "back")
  .q("currentHistory", "history__forward", "forward");

function AppMenu() {
  const dispatch = useDispatch();
  const { currentWindow, back, forward } = useQuery(qAppMenu, {
    browser: "browser",
  })!;

  return (
    <nav>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.back, { windowId: currentWindow as string });
        }}
        disabled={!back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.forward, { windowId: currentWindow as string });
        }}
        disabled={!forward}
      >
        Forward
      </button>
      <FileLink id="home" target="new" />
      <FileLink id="omnibox" target="new" />
    </nav>
  );
}

const qApp = new QueryBuilder(["browser", "windowSchema"])
  .q("browser", "browser__currentWindow", "currentWindow")
  .q("windows", "db__schema", "windowSchema");

function App() {
  const { currentWindow, windows } = useQuery(qApp, {
    browser: "browser",
    windowSchema: "schema__window",
  })!;
  const windowIDs = [...((windows as Set<string>) || [])];
  return (
    <>
      <AppMenu />
      {windowIDs.map((id) => (
        <AppWindow key={id} windowId={id} isCurrent={currentWindow === id} />
      ))}
    </>
  );
}

export default App;
