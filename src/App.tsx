import { useDispatch, useQuery, useQueryAll, useRender } from "./state";
import { q, Query, HydratedViewElement, hydrateViewElement } from "./runtime";
import { k, Scope } from "./expr";
import { ViewElement } from "./view";
import { Link, TabProvider } from "./primitive";
import * as primitiveViews from "./primitive";
import { ViewPrimitive } from "./schema";
import "./App.css";

const qView = q("view") //
  .get("view", "view__query", "query")
  .get("view", "view__elements", "els")
  .get("view", "view__noResults", "noResultEls")
  .get("view", "view__primitive", "primitive");
function SubView({
  view,
  args,
  children,
}: {
  view: string;
  args: Scope;
  children?: HydratedViewElement[];
}) {
  const { els, noResultEls, query, primitive } = useQuery(qView, { view })!;
  const result = Array.from(useQueryAll((query as Query) ?? q(), args));
  const renders = Array.from(useRender((query as Query) ?? q(), args));

  if (result.length === 0) {
    return ((noResultEls as ViewElement[]) ?? []).map((el, i) => (
      <SubView key={i} {...hydrateViewElement(args, el)} />
    ));
  }

  if (primitive) {
    const PrimitiveView = primitiveViews[primitive as ViewPrimitive];
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <PrimitiveView {...(args as any)}>
        {(children ?? []).map((childProps, i) => (
          <SubView key={i} {...childProps} />
        ))}
      </PrimitiveView>
    );
  }

  return (
    <>
      <>
        {renders.map((el, i) => (
          <SubView key={i} {...el} />
        ))}
      </>
      {result.map((scope, i) => (
        <div key={i}>
          {((els as ViewElement[]) ?? []).map((el, j) => (
            <SubView key={j} {...hydrateViewElement(scope, el)} />
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
      <Link id="home" target="new" label="Home" />
      <Link id="omnibox" target="new" label="Omnibox" />
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
