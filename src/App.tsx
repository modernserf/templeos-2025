import { useDispatch, useQuery, useQueryAll } from "./state";
import "./App.css";
import { q, Query } from "./db";
import { getVar, k, Scope } from "./expr";
import { ViewElement } from "./view";
import { FileLink, TabProvider } from "./primitive";
import * as primitiveViews from "./primitive";
import { ViewPrimitive } from "./schema";

const qView = q("view") //
  .get("view", "view__query", "query")
  .get("view", "view__elements", "els")
  .get("view", "view__primitive", "primitive");
function SubView({ view, args }: { view: string; args: Scope }) {
  const { els, query, primitive } = useQuery(qView, { view })!;
  const result = useQueryAll((query as Query) ?? q(), args);

  if (primitive) {
    const View = primitiveViews[primitive as ViewPrimitive];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <View {...(args as any)} />;
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
  .get("view", "view__schema", "schema")
  .get("view", "file__name", "viewName");

const qViewsForAnyType = q()
  .get("view", "view__schema", k("schema__anyType"))
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
  .get("id", "db__schema", k("schema__window"));

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
