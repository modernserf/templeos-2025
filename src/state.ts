import { configureStore, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction as P } from "@reduxjs/toolkit";
import "./App.css";

type TextNode =
  | {
      tag: "text";
      text: string;
    }
  | { tag: "link"; text: string; params: BrowseParams };

export type Rec = {
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

export type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
};

export type WindowHistory = BrowseParams & {
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

export const db = createSlice({
  name: "db",
  initialState: initDB,
  reducers: {},
  selectors: {
    get: (db, id) => db[id],
  },
});

export const index = createSlice({
  name: "index",
  initialState: createIndex(initDB),
  reducers: {},
  selectors: {
    get: (db, id) => db[id],
  },
});

const windowsState = {
  windows: [{ id: "home" }] as WindowHistory[],
  currentWindow: 0,
};

export const windows = createSlice({
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
      {
        payload: { id, params },
      }: P<{ id: number; params: Partial<BrowseParams> }>
    ) {
      Object.assign(state.windows[id], params);
    },
    push(
      state,
      { payload: { id, params } }: P<{ id: number; params: BrowseParams }>
    ) {
      const current = state.windows[id];
      current.forward = undefined;
      state.windows[id] = {
        ...params,
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

export type IRootState = ReturnType<typeof store.getState>;
