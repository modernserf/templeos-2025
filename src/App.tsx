import { useEffect, useRef, useContext, createContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./App.css";
import { windows, db, index, BrowseParams, Rec } from "./state";

const tabContext = createContext(0);
const TabProvider = tabContext.Provider;

type Target = "current" | "new";

function Link({
  params,
  children,
  target = "current",
}: {
  params: BrowseParams;
  children: React.ReactNode;
  target?: Target;
}) {
  const dispatch = useDispatch();
  const id = useContext(tabContext);
  return (
    <button
      type="button"
      onClick={(e) => {
        if (e.altKey || target === "new") {
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

function FileLink({ id, target }: { id: string; target?: Target }) {
  const rec = useSelector(db.selectSlice)[id];
  return (
    <Link params={{ id }} target={target}>
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

function DataView({ window, currentCard }: ViewParams) {
  const indexFields = Object.entries(
    useSelector(index.selectSlice)[window.id] ?? {}
  );
  const _db = useSelector(db.selectSlice);

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
              {_db[key].field__refType && typeof value === "string" ? (
                <FileLink id={value} />
              ) : (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              )}
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
              <Link key={i} params={node.params}>
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
    <div>
      <input
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
      <ul>
        {results.map(([key, value]) => (
          <li key={key}>
            <Link params={{ id: key }}>{value.file__name ?? key}</Link>
            <span>{value.file__description}</span>
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

function App() {
  const dispatch = useDispatch();
  const { windows: ws, currentWindow } = useSelector(windows.selectSlice);
  const _db = useSelector(db.selectSlice);
  const _index = useSelector(index.selectSlice);
  const _windows = ws.map((window, id) => {
    const isCurrent = currentWindow === id;
    const card = _db[window.id] ?? _db.notFound;
    const viewersForType = _index[card.db__schema ?? ""]?.view__schema ?? [];

    const view =
      _db[window.view ?? ""] ??
      _db[viewersForType[0] ?? ""] ??
      _db.view__anyType;

    const View = viewByName[view.view__component!];

    return { window, isCurrent, card, viewersForType, View };
  });

  const viewersForType = _windows[currentWindow]?.viewersForType ?? [];
  const viewersForAnyType = _index.schema__anyType?.view__schema ?? [];

  return (
    <>
      {_windows.map(({ View, window, isCurrent, card }, id) => {
        return (
          <TabProvider key={id} value={id}>
            <div
              style={{
                opacity: isCurrent ? 1 : "0.5",
              }}
              onMouseDownCapture={() => {
                dispatch(windows.actions.selectWindow({ id }));
              }}
            >
              <button
                type="button"
                onClick={() => {
                  dispatch(windows.actions.closeWindow({ id }));
                }}
              >
                &times;
              </button>
              <h1>{card.file__name}</h1>
              <View currentCard={card} window={window} />
            </div>
          </TabProvider>
        );
      })}
      <nav>
        <button
          type="button"
          onClick={() => {
            dispatch(windows.actions.back({ id: currentWindow }));
          }}
          disabled={!_windows[currentWindow].window?.back}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch(windows.actions.forward({ id: currentWindow }));
          }}
          disabled={!_windows[currentWindow].window?.forward}
        >
          Forward
        </button>
        <FileLink id="home" target="new" />
        <FileLink id="omnibox" target="new" />
        <select
          value={_windows[currentWindow].window?.view ?? ""}
          onChange={(e) => {
            dispatch(
              windows.actions.replace({
                id: currentWindow,
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
      </nav>
    </>
  );
}

export default App;
