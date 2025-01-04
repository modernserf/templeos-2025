import { useEffect, useRef, useContext, createContext } from "react";
import {
  BrowseParams,
  Rec,
  useDB,
  actions,
  selectors,
  useDispatch,
  useQuery,
} from "./state";
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
          dispatch(actions.newWindow, { params });
        } else {
          dispatch(actions.push, { params, windowId });
        }
      }}
    >
      {children}
    </button>
  );
}

function FileLink({ id, target }: { id: string; target?: Target }) {
  const { fileName } = useQuery((b) => {
    b.q(id, "file__name", b.v("fileName"));
  })!;
  return (
    <Link params={{ id }} target={target} className="FileLink">
      {(fileName as string) ?? id}
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
  const { refType } = useQuery((b) => {
    b.q(id, "field__refType", b.v("refType"));
  })!;

  return refType && typeof value === "string" ? (
    <FileLink id={value} />
  ) : (
    <pre>{JSON.stringify(value, null, 2)}</pre>
  );
}

function DataView({ history, currentCard }: ViewParams) {
  const indexFields = Object.entries(
    useDB().index[history.history__location!] ?? {}
  );

  return (
    <table>
      <tbody>
        <tr>
          <td>id</td>
          <td>{history.history__location}</td>
        </tr>
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
          return [...values].map((value, i) => (
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
  const db = useDB();
  const windowId = useContext(tabContext);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const omnibox = history.history__data?.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const results = Object.entries(db.data).filter(
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
          actions.replace(db, {
            windowId,
            params: { data: { omnibox: e.target.value } },
          });
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
  const db = useDB();
  const { history, historyView, historyLocation } = useQuery((b) => {
    b.q(windowId, "window__currentHistory", b.v("historyId"));
    b.q(b.v("historyId"), "history__view", b.v("historyView"));
    b.q(b.v("historyId"), "history__location", b.v("historyLocation"));
    b.get(b.v("historyId"), b.v("history"));
  })!;

  const card = db.data[historyLocation as string] ?? db.data.notFound;
  const viewersForType = selectors.viewersForType(db, card.db__schema!);
  const view =
    db.data[historyView as string] ??
    db.data[viewersForType[0]!] ??
    db.data.view__anyType;

  const View = viewByName[view.view__component!];
  const viewersForAnyType = selectors.viewersForAnyType(db);

  return (
    <TabProvider value={windowId}>
      <div
        tabIndex={0}
        className={["AppWindow", isCurrent && "AppWindow--current"]
          .filter(Boolean)
          .join(" ")}
        onMouseDownCapture={() => {
          actions.selectWindow(db, { windowId });
        }}
        onKeyDownCapture={(e) => {
          if (e.key == "[" && e.metaKey) {
            e.preventDefault();
            actions.back(db, { windowId });
          }
          if (e.key == "]" && e.metaKey) {
            e.preventDefault();
            actions.forward(db, { windowId });
          }
        }}
      >
        <header className="AppWindow__header">
          <button
            className="AppWindow__closeButton"
            type="button"
            onClick={() => {
              actions.closeWindow(db, { windowId });
            }}
          ></button>
          <h1 className="AppWindow__title">{card.file__name}</h1>
          <select
            className="AppWindow__viewMenu"
            value={historyView as string}
            onChange={(e) => {
              actions.replace(db, {
                windowId,
                params: { view: e.target.value },
              });
            }}
          >
            {viewersForType.concat(viewersForAnyType).map((viewId) => (
              <option key={viewId} value={viewId}>
                {db.data[viewId].file__name ?? viewId}
              </option>
            ))}
          </select>
        </header>
        <View currentCard={card} history={history as Rec} />
      </div>
    </TabProvider>
  );
}

function AppMenu() {
  const dispatch = useDispatch();
  const { currentWindow, back, forward } = useQuery((b) => {
    b.q("browser", "browser__currentWindow", b.v("currentWindow"));
    b.q(b.v("currentWindow"), "window__currentHistory", b.v("currentHistory"));
    b.q(b.v("currentHistory"), "history__back", b.v("back"));
    b.q(b.v("currentHistory"), "history__forward", b.v("forward"));
  })!;

  return (
    <nav>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.back, { windowId: currentWindow as string });
        }}
        disabled={!back}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch(actions.forward, { windowId: currentWindow as string });
        }}
        disabled={!forward}
      >
        Forward
      </button>
      <FileLink id="home" target="new" />
      <FileLink id="omnibox" target="new" />
    </nav>
  );
}

function App() {
  const { currentWindow, windows } = useQuery((b) => {
    b.q("browser", "browser__currentWindow", b.v("currentWindow"));
    b.q(b.v("windows"), "db__schema", "schema__window");
  })!;
  const windowIDs = [...((windows as Set<string>) || [])];
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
