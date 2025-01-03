import { useEffect, useRef } from "react";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import type { PayloadAction as P } from "@reduxjs/toolkit";
import "./App.css";

type TextNode =
  | {
      tag: "text";
      text: string;
    }
  | { tag: "link"; text: string; params: BrowseParams };

type Rec = {
  file__name?: string;
  file__description?: string;
  file__folderItems?: string[];
  text__content?: TextNode[];
  db__schema?: string;
  field__refType?: string;
  index__field?: string;
  view__component?: string;
  view__schema?: string;
};

type Index = {
  view__schema?: string[];
};

type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
};

type WindowHistory = BrowseParams & {
  back?: WindowHistory;
  forward?: WindowHistory;
};

type DB = Record<string, Rec>;
const initDB: DB = {
  // schemas
  schema__schema: {
    db__schema: "schema__schema",
    file__name: "Schema",
    file__description:
      "Schema defines the fields in a record & is used to select the viewer",
  },
  schema__field: {
    db__schema: "schema__schema",
    file__name: "Field",
  },
  schema__index: {
    db__schema: "schema__schema",
    file__name: "Index",
    file__description: "Index allows lookup of records by their content",
  },
  schema__anyType: {
    db__schema: "schema__schema",
    file__name: "AnyType",
    file__description: "fallback schema for any type of record",
  },
  schema__text: {
    db__schema: "schema__schema",
    file__name: "Text",
    file__description: "schema for Text",
  },
  schema__view: {
    db__schema: "schema__schema",
    file__name: "View",
    file__description: "schema for View",
  },
  schema__folder: {
    db__schema: "schema__schema",
    file__name: "Folder",
    file__description: "schema for Folder",
  },
  // fields
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: "schema used to validate & render this record",
    field__refType: "schema__schema",
  },
  field__refType: {
    db__schema: "schema__field",
    file__name: "Field refType",
    file__description:
      "if this is set, the value of this field is a ref to a record with this schema",
    field__refType: "schema__schema",
  },
  index__field: {
    db__schema: "schema__field",
    file__name: "Index field",
    file__description: "the field this is indexing",
    field__refType: "schema__field",
  },
  view__component: {
    db__schema: "schema__field",
    file__name: "View component",
    file__description: "name of the primitive component used for rendering",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View schema",
    file__description: "the schema that this view is supposed to render",
    field__refType: "schema__schema",
  },
  file__name: {
    db__schema: "schema__field",
    file__name: "File name",
    file__description: "field used for name in tab header & file explorer",
  },
  file__description: {
    db__schema: "schema__field",
    file__name: "File description",
    file__description: "describes the content of the record",
  },
  file__folderItems: {
    db__schema: "schema__field",
    file__name: "File folder items",
    file__description: "ids of files in folder",
  },
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: "a list of text nodes used in text schema",
  },
  // Indexes
  index__db__schema: {
    db__schema: "schema__index",
    file__name: "db__schema index",
    index__field: "db__schema",
  },
  index__view__schema: {
    db__schema: "schema__index",
    file__name: "view__schema index",
    file__description:
      "used for looking up the viewers that can render records with a given schema",
    index__field: "view__schema",
  },
  index__index__field: {
    db__schema: "schema__index",
    file__name: "index__field index",
    index__field: "index__field",
  },
  index__field__refType: {
    db__schema: "schema__index",
    file__name: "field__refType index",
    index__field: "field__refType",
  },
  index__file__folderItems: {
    db__schema: "schema__index",
    file__name: "file__folderItems index",
    index__field: "file__folderItems",
  },
  // Views
  view__anyType: {
    db__schema: "schema__view",
    file__name: "DataView",
    file__description: "default viewer for all data types",
    view__component: "DataView",
    view__schema: "schema__anyType",
  },
  view__text: {
    db__schema: "schema__view",
    file__name: "TextView",
    file__description: "viewer for text cards",
    view__component: "TextView",
    view__schema: "schema__text",
  },
  view__folderList: {
    db__schema: "schema__view",
    file__name: "FolderListView",
    file__description: "viewer for folders as list",
    view__component: "FolderListView",
    view__schema: "schema__folder",
  },
  view__folderIcon: {
    db__schema: "schema__view",
    file__name: "FolderIconView",
    file__description: "viewer for folders as icon grid",
    view__component: "FolderIconView",
    view__schema: "schema__folder",
  },
  // Cards
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: "this is the home card",
    text__content: [
      { tag: "text", text: "content that " },
      { tag: "link", text: "links", params: { id: "other" } },
      { tag: "text", text: " to another card." },
    ],
  },
  other: {
    file__name: "other",
    file__description: "this is the other card",
  },
  example__folder: {
    db__schema: "schema__folder",
    file__name: "Example Folder",
    file__description: "A folder with some items",
    file__folderItems: ["home", "schema__text", "view__text"],
  },
  notFound: {
    file__name: "not found",
    file__description: "Card not found",
  },
  // a self-rendering component
  omnibox: {
    db__schema: "omnibox",
    file__name: "Omnibox",
    view__component: "OmniboxView",
    view__schema: "omnibox",
  },
};

type DBIndex = Record<string, Index>;

function createIndex(db: DB): DBIndex {
  const out: DBIndex = {};
  const indexes = Object.values(db).filter(
    (rec) => rec.db__schema === "schema__index"
  );

  for (const [id, rec] of Object.entries(db)) {
    for (const index of indexes) {
      const field = index.index__field!;
      if (field in rec) {
        const items = Array.isArray(rec[field]) ? rec[field] : [rec[field]];
        console.log(out, field, items);
        for (const value of items) {
          out[value] ??= {};
          out[value][field] ??= [];
          out[value][field].push(id);
        }
      }
    }
  }
  return out;
}

const db = createSlice({
  name: "db",
  initialState: initDB,
  reducers: {},
});

const index = createSlice({
  name: "index",
  initialState: createIndex(initDB),
  reducers: {},
});

// TODO: always provide window id (thru context?) instead of falling back on currentWindow
const windowsState = {
  windows: [{ id: "home" }] as WindowHistory[],
  currentWindow: 0,
};

const windows = createSlice({
  name: "windows",
  initialState: windowsState,
  reducers: {
    back(state, { payload: { id } }: P<{ id: number }>) {
      const current = state.windows[id];
      if (current.back) {
        state.windows[id] = current.back;
        current.back = undefined;
        state.windows[id].forward = current;
      }
    },
    forward(state, { payload: { id } }: P<{ id: number }>) {
      const current = state.windows[id];
      if (current.forward) {
        state.windows[id] = current.forward;
        current.forward = undefined;
        state.windows[id].back = current;
      }
    },
    replace(
      state,
      { payload }: P<{ id?: number; params: Partial<BrowseParams> }>
    ) {
      const id = payload.id ?? state.currentWindow;
      Object.assign(state.windows[id], payload.params);
    },
    push(state, { payload }: P<{ id?: number; params: BrowseParams }>) {
      const id = payload.id ?? state.currentWindow;
      const current = state.windows[id];
      current.forward = undefined;
      state.windows[id] = {
        ...payload.params,
        back: current,
      };
    },
    newWindow(state, { payload: { params } }: P<{ params: BrowseParams }>) {
      state.windows.push(params);
      state.currentWindow = state.windows.length - 1;
    },
    selectWindow(state, { payload: { id } }: P<{ id: number }>) {
      state.currentWindow = id;
    },
    closeWindow(state, { payload: { id } }: P<{ id: number }>) {
      state.windows.splice(id, 1);
      if (state.windows.length > 0) {
        state.currentWindow %= state.windows.length;
      }
    },
  },
});

export const store = configureStore({
  reducer: { windows: windows.reducer, db: db.reducer, index: index.reducer },
});

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
  return (
    <button
      type="button"
      onClick={(e) => {
        if (e.altKey || target === "new") {
          dispatch(windows.actions.newWindow({ params }));
        } else {
          dispatch(windows.actions.push({ params }));
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
          <div
            key={id}
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
