import { useDB, useEventHandler, useQueryResult } from "./state";
import { q } from "./query";
import { k } from "./expr";
import { Query } from "./primitive";
import "./App.css";
import { QueryState } from "./runtime";

const qAppWindow = q("windowId")
  .get("windowId", "window__currentHistory", "historyId")
  .get("historyId", "history__location", "id")
  .get("historyId", "history__view", "viewId")
  .get("id", "file__name", "fileName")
  .build();

const qViewsForType = q("id")
  .or((q) =>
    q
      .get("id", "db__schema", "schema")
      .get("view", "view__schema", "schema")
      .get("view", "file__name", "viewName")
  )
  .get("view", "view__schema", k("schema__anyType"))
  .get("view", "file__name", "viewName")
  .build();

const qRootView = q("windowId", "id", "view")
  .setContext("windowId", "windowId")
  .setContext("id", "id")
  .view("view", { id: "id" })
  .build();

const onChangeView = q("windowId", "view")
  .get("windowId", "window__currentHistory", "h")
  .update("h", "history__view", "view")
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
  const [{ id, viewId, fileName }] = Array.from(
    useQueryResult<{
      id: string;
      viewId: string;
      fileName: string;
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
            handle(onChangeView, { windowId, view: e.target.value });
          }}
        >
          {viewers.map((v) => (
            <option key={v.view} value={v.view}>
              {v.viewName ?? viewId}
            </option>
          ))}
        </select>
      </header>
      <Query state={state} query={qRootView} args={{ windowId, id, view }} />
    </div>
  );
}

const qApp = q()
  .get(k("browser"), "browser__currentWindow", "currentWindow")
  .get("id", "db__schema", k("schema__window"))
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
