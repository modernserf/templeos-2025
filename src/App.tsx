import { useDB, useEventHandler, useQueryResult } from "./state";
import { q } from "./query";
import { k } from "./expr";
import { TabProvider, Query } from "./primitive";
import "./App.css";
import { QueryState } from "./runtime";

const qAppWindow = q("windowId")
  .get("windowId", "window__currentHistory", "historyId")
  .get("historyId", "history__data", "data")
  .get("historyId", "history__location", "id")
  .get("historyId", "history__view", "viewId")
  .get("id", "file__name", "fileName")
  .result()
  .build();

const qViewsForType = q("id")
  .or((q) =>
    q
      .get("id", "db__schema", "schema")
      .get("view", "view__schema", "schema")
      .get("view", "file__name", "viewName")
      .result()
  )
  .get("view", "view__schema", k("schema__anyType"))
  .get("view", "file__name", "viewName")
  .result()
  .build();

const qRootView = q("id", "view", "data")
  .view("view", { id: "id", view: "view", data: "data" })
  .build();

function AppWindow({
  windowId,
  isCurrent,
  state,
}: {
  state: QueryState;
  windowId: string;
  isCurrent: boolean;
}) {
  const [{ data, id, viewId, fileName }] = Array.from(
    useQueryResult<{
      id: string;
      viewId: string;
      fileName: string;
      data: Record<string, string>;
    }>(state, qAppWindow, {
      windowId,
    })
  );
  const viewers = Array.from(
    useQueryResult<{ view: string; viewName: string }>(state, qViewsForType, {
      id,
    })
  );
  const view = viewId || viewers[0].view;
  const handle = useEventHandler(state);
  const dispatch = (name: string, args: Record<string, unknown>) => {
    const argExprs = Object.fromEntries(
      Object.keys(args).map((key) => [key, key])
    );
    handle(q().rule(name, argExprs).build(), args);
  };

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          dispatch("rule__selectWindow", { windowId });
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            dispatch("rule__back", { windowId });
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            dispatch("rule__forward", { windowId });
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              dispatch("rule__closeWindow", { windowId });
            }}
          ></button>
          <h1 className="AppWindow__title">{fileName}</h1>
          <select
            className="AppWindow__viewMenu"
            value={view}
            onChange={(e) => {
              dispatch("rule__replace", {
                id: undefined,
                data: undefined,
                windowId,
                view: e.target.value,
              });
            }}
          >
            {viewers.map((v) => (
              <option key={v.view} value={v.view}>
                {v.viewName ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <Query
          state={state}
          query={qRootView}
          args={{ id, view, data: data ?? {} }}
        />
      </div>
    </TabProvider>
  );
}

const qApp = q()
  .get(k("browser"), "browser__currentWindow", "currentWindow")
  .get("id", "db__schema", k("schema__window"))
  .result()
  .build();

const qAppMenu = q().view(k("view__appMenu"), {}).build();

function App() {
  const state = useDB();
  const windows = Array.from(
    useQueryResult<{
      id: string;
      currentWindow: string;
    }>(state, qApp)
  );
  return (
    <>
      <nav>
        <Query state={state} query={qAppMenu} args={{}} />
      </nav>
      {windows.map(({ id, currentWindow }) => (
        <AppWindow
          state={state}
          key={id}
          windowId={id}
          isCurrent={currentWindow === id}
        />
      ))}
    </>
  );
}

export default App;
