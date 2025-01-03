import { useEffect, useRef, useContext, createContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { windows, db, index, BrowseParams, Rec, WindowHistory } from "./state";
import "./App.css";

const tabContext = createContext(0);
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
  const id = useContext(tabContext);
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        if (e.metaKey || target === "new") {
          dispatch(windows.actions.newWindow({ params }));
        } else {
          dispatch(windows.actions.push({ params, id }));
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
  const rec = useSelectorParams(db.selectors.get, id);
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {rec.file__name ?? id}
    </Link>
  );
}

type ViewParams = {
  currentCard: Rec;
  window: BrowseParams;
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
  const field = useSelectorParams(db.selectors.get, id);
  return field.field__refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

function DataView({ window, currentCard }: ViewParams) {
  const indexFields = Object.entries(
    useSelectorParams(index.selectors.get, window.id) ?? {}
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

function OmniboxView({ window }: ViewParams) {
  const dispatch = useDispatch();
  const id = useContext(tabContext);
  const _db = useSelector(db.selectSlice);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = window.data?.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const results = Object.entries(_db).filter(
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
        onChange={(e) =>
          dispatch(
            windows.actions.replace({
              id,
              params: { data: { omnibox: e.target.value } },
            })
          )
        }
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
  id,
  window,
  isCurrent,
}: {
  id: number;
  window: WindowHistory;
  isCurrent: boolean;
}) {
  const dispatch = useDispatch();
  const _db = useSelector(db.selectSlice);
  const _index = useSelector(index.selectSlice);

  const card = _db[window.id] ?? _db.notFound;
  const viewersForType = _index[card.db__schema ?? ""]?.view__schema ?? [];
  const view =
    _db[window.view ?? ""] ?? _db[viewersForType[0] ?? ""] ?? _db.view__anyType;

  const View = viewByName[view.view__component!];
  const viewersForAnyType = _index.schema__anyType?.view__schema ?? [];

  return (
    <TabProvider value={id}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          dispatch(windows.actions.selectWindow({ id }));
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            dispatch(windows.actions.back({ id }));
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            dispatch(windows.actions.forward({ id }));
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              dispatch(windows.actions.closeWindow({ id }));
            }}
          ></button>
          <h1 className="AppWindow__title">{card.file__name}</h1>
          <select
            className="AppWindow__viewMenu"
            value={window?.view ?? ""}
            onChange={(e) => {
              dispatch(
                windows.actions.replace({
                  id,
                  params: { view: e.target.value },
                })
              );
            }}
          >
            {viewersForType.concat(viewersForAnyType).map((viewId) => (
              <option key={viewId} value={viewId}>
                {_db[viewId].file__name ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <View currentCard={card} window={window} />
      </div>
    </TabProvider>
  );
}

function AppMenu() {
  const dispatch = useDispatch();
  const { windows: ws, currentWindow } = useSelector(windows.selectSlice);
  const window = ws[currentWindow];

  return (
    <nav>
      <button
        type="button"
        onClick={() => {
          dispatch(windows.actions.back({ id: currentWindow }));
        }}
        disabled={!window?.back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(windows.actions.forward({ id: currentWindow }));
        }}
        disabled={!window?.forward}
      >
        Forward
      </button>
      <FileLink id="home" target="new" />
      <FileLink id="omnibox" target="new" />
    </nav>
  );
}

function App() {
  const { windows: ws, currentWindow } = useSelector(windows.selectSlice);
  return (
    <>
      <AppMenu />
      {ws.map((window, id) => (
        <AppWindow
          key={id}
          id={id}
          window={window}
          isCurrent={currentWindow === id}
        />
      ))}
    </>
  );
}

export default App;
