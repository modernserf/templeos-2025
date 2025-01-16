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
  .limit(1)
  .or((q) =>
    q.get("id", "db__schema", "schema").get("view", "view__schema", "schema")
  )
  .get("view", "view__schema", k("schema__anyType"))
  .build();

const qViewMenu = q("windowId", "id", "view")
  .view(
    k("view__select"),
    {
      value: "view",
      query: k(
        q("nextView")
          .get("windowId", "window__currentHistory", "h")
          .update("h", "history__view", "nextView")
          .build()
      ),
    },
    q()
      .or((q) =>
        q
          .get("id", "db__schema", "schema")
          .get("viewId", "view__schema", "schema")
          .get("viewId", "file__name", "viewName")
          .view(k("view__option"), { id: "viewId", label: "viewName" })
      )
      .get("viewId", "view__schema", k("schema__anyType"))
      .get("viewId", "file__name", "viewName")
      .view(k("view__option"), { id: "viewId", label: "viewName" })
      .build()
  )
  .build();

const qRootView = q("windowId", "id", "view")
  .setContext("windowId", "windowId")
  .setContext("id", "id")
  .view("view", { id: "id" })
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
  const handle = useEventHandler(state);
  const dispatch = (name: string, args: Record<string, unknown>) => {
    const argExprs = Object.fromEntries(
      Object.keys(args).map((key) => [key, key])
    );
    handle(q().rule(name, argExprs).build(), args);
  };

  const [{ id, viewId, fileName }] = Array.from(
    useQueryResult<{
      id: string;
      viewId: string;
      fileName: string;
    }>(state, qAppWindow, {
      windowId,
    })
  );
  const [currentView] = Array.from(
    useQueryResult<{ view: string; viewName: string }>(state, qViewsForType, {
      id,
    })
  );
  const view = viewId || currentView.view;

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
        <Query state={state} query={qViewMenu} args={{ windowId, id, view }} />
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
