import { useEffect, useRef, useContext, createContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { actions, selectors, BrowseParams, Rec } from "./state";
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
          dispatch(actions.newWindow({ params }));
        } else {
          dispatch(actions.push({ params, windowId }));
        }
      }}
    >
      {children}
    </button>
  );
}

function useSelectorParams<State, Params, Out>(
  fn: (s: State, p: Params) => Out,
  p: Params
) {
  return useSelector<State, Out>((state) => fn(state, p));
}

function FileLink({ id, target }: { id: string; target?: Target }) {
  const rec = useSelectorParams(selectors.dbGet, id);
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {rec.file__name ?? id}
    </Link>
  );
}

type ViewParams = {
  currentCard: Rec;
  history: Rec;
};

function FolderListView({ currentCard }: ViewParams) {
  return (
    <ul>
      {(currentCard.file__folderItems ?? []).map((id) => (
        <li key={id}>
          <FileLink id={id} />
        </li>
      ))}
    </ul>
  );
}

function FolderIconView({ currentCard }: ViewParams) {
  return (
    <ul style={{ display: "flex" }}>
      {(currentCard.file__folderItems ?? []).map((id) => (
        <li key={id}>
          <div style={{ textAlign: "center", fontSize: 32 }}>📄</div>
          <FileLink id={id} />
        </li>
      ))}
    </ul>
  );
}

function DataViewField({ id, value }: { id: string; value: unknown }) {
  const field = useSelectorParams(selectors.dbGet, id);
  return field.field__refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

function DataView({ history, currentCard }: ViewParams) {
  const indexFields = Object.entries(
    useSelectorParams(selectors.indexGet, history.history__location!) ?? {}
  );

  return (
    <table>
      <tbody>
        <tr>
          <th colSpan={2}>Fields</th>
        </tr>
        {Object.entries(currentCard).map(([key, value]) => (
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
          return values.map((value, i) => (
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

function TextView({ currentCard }: ViewParams) {
  return (
    <div>
      {(currentCard.text__content ?? []).map((node, i) => {
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

function OmniboxView({ history }: ViewParams) {
  const dispatch = useDispatch();
  const windowId = useContext(tabContext);
  const db = useSelector(selectors.db);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = history.history__data?.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const results = Object.entries(db).filter(
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
          dispatch(
            actions.replace({
              windowId,
              params: { data: { omnibox: e.target.value } },
            })
          );
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

const viewByName: Record<string, React.FC<ViewParams>> = {
  TextView,
  DataView,
  OmniboxView,
  FolderListView,
  FolderIconView,
};

function AppWindow({
  windowId,
  isCurrent,
}: {
  windowId: string;
  isCurrent: boolean;
}) {
  const dispatch = useDispatch();
  const db = useSelector(selectors.db);
  const history = db[db[windowId].window__currentHistory!]!;

  const card = db[history.history__location!] ?? db.notFound;
  const viewersForType = useSelectorParams(
    selectors.viewersForType,
    card.db__schema!
  );
  const view =
    db[history.history__view!] ?? db[viewersForType[0]!] ?? db.view__anyType;

  const View = viewByName[view.view__component!];
  const viewersForAnyType = useSelector(selectors.viewersForAnyType);

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          dispatch(actions.selectWindow({ windowId }));
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            dispatch(actions.back({ windowId }));
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            dispatch(actions.forward({ windowId }));
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              dispatch(actions.closeWindow({ windowId }));
            }}
          ></button>
          <h1 className="AppWindow__title">{card.file__name}</h1>
          <select
            className="AppWindow__viewMenu"
            value={history.history__view!}
            onChange={(e) => {
              dispatch(
                actions.replace({
                  windowId,
                  params: { view: e.target.value },
                })
              );
            }}
          >
            {viewersForType.concat(viewersForAnyType).map((viewId) => (
              <option key={viewId} value={viewId}>
                {db[viewId].file__name ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <View currentCard={card} history={history} />
      </div>
    </TabProvider>
  );
}

function AppMenu() {
  const dispatch = useDispatch();
  const currentWindow = useSelector(selectors.db).browser
    .browser__currentWindow!;
  // const window = ws[currentWindow];

  return (
    <nav>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.back({ windowId: currentWindow }));
        }}
        // disabled={!window?.back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.forward({ windowId: currentWindow }));
        }}
        // disabled={!window?.forward}
      >
        Forward
      </button>
      <FileLink id="home" target="new" />
      <FileLink id="omnibox" target="new" />
    </nav>
  );
}

function App() {
  const db = useSelector(selectors.db);
  const currentWindow = db.browser.browser__currentWindow!;
  const windowIDs = Object.entries(db)
    .filter(([, value]) => value.db__schema === "schema__window")
    .map((x) => x[0]);
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
