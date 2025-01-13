import { useDispatch, useQuery, useQueryAll, useRender } from "./state";
import { q } from "./query";
import { k } from "./expr";
import { Link, TabProvider } from "./primitive";
import * as primitiveViews from "./primitive";
import "./App.css";
import { ViewPrimitive } from "./schema";
import { QueryResult } from "./runtime";

function Primitive({
  primitive,
  args,
  children,
}: {
  primitive: ViewPrimitive;
  args: Record<string, unknown>;
  children: (QueryResult & { tag: "viewPrimitive" })[];
}) {
  const View = primitiveViews[primitive];
  return (
    <View {...args}>
      {children.map((child, i) => (
        <Primitive key={i} {...child} />
      ))}
    </View>
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
  .or((q) =>
    q
      .get("id", "db__schema", "schema")
      .get("view", "view__schema", "schema")
      .get("view", "file__name", "viewName")
  )
  .get("view", "view__schema", k("schema__anyType"))
  .get("view", "file__name", "viewName")
  .build();

const qRootView = q("id", "view", "data")
  .view("view", { id: "id", view: "view", data: "data" })
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

  const viewers = [...useQueryAll(qViewsForType, { id })];

  const view = (viewId as string) || viewers[0].view;
  const renders = Array.from(
    useRender(qRootView, { id, view, data: data ?? {} })
  );

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
          <h1 className="AppWindow__title">{fileName as string}</h1>
          <select
            className="AppWindow__viewMenu"
            value={view as string}
            onChange={(e) => {
              dispatch("rule__replace", {
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
        {renders.map((props, i) => (
          <Primitive key={i} {...props} />
        ))}
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
          dispatch("rule__back", { windowId: win?.id as string });
        }}
        disabled={!win?.back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch("rule__forward", { windowId: win?.id as string });
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
