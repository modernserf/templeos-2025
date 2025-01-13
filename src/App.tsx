import { useDispatch, useQuery, useQueryAll, useRender } from "./state";
import { q } from "./query";
import { k } from "./expr";
import { Link, TabProvider } from "./primitive";
import * as primitiveViews from "./primitive";
import "./App.css";

const qRootView = q("id", "view", "data")
  .view("view", { id: "id", view: "view", data: "data" })
  .build();

function RootView({ id, view, data }) {
  const renders = Array.from(useRender(qRootView, { id, view, data }));

  return (
    <>
      {renders.map(({ primitive, args }, i) => {
        const PrimitiveView = primitiveViews[primitive];
        return <PrimitiveView key={i} {...args} />;
      })}
    </>
  );
}

const qAppWindow = q("windowId")
  .get("windowId", "window__currentHistory", "historyId")
  .get("historyId", "history__data", "data")
  .get("historyId", "history__location", "id")
  .get("historyId", "history__view", "viewId")
  .get("id", "file__name", "fileName")
  .build();

const qViewsForType = q("id")
  .get("id", "db__schema", "schema")
  .get("view", "view__schema", "schema")
  .get("view", "file__name", "viewName")
  .build();

const qViewsForAnyType = q()
  .get("view", "view__schema", k("schema__anyType"))
  .get("view", "file__name", "viewName")
  .build();

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
        <RootView id={id} view={activeView as string} data={data ?? {}} />
      </div>
    </TabProvider>
  );
}

const qAppMenu = q()
  .get(k("browser"), "browser__currentWindow", "id")
  .get("id", "window__currentHistory", "currentHistory")
  .get("currentHistory", "history__back", "back")
  .get("currentHistory", "history__forward", "forward")
  .build();

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
      <Link id="home" target="new" label="Home" />
      <Link id="omnibox" target="new" label="Omnibox" />
    </nav>
  );
}

const qApp = q()
  .get(k("browser"), "browser__currentWindow", "currentWindow")
  .get("id", "db__schema", k("schema__window"))
  .build();

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
