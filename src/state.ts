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
  history__window?: string;
  history__location?: string;
  history__view?: string;
  history__data?: Record<string, string>;
  history__back?: string;
  history__forward?: string;
  window__currentHistory?: string;
  browser__currentWindow?: string;
};

type Index = {
  db__schema?: string[];
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
  schema__history: {
    db__schema: "schema__schema",
    file__name: "History",
  },
  schema__window: {
    db__schema: "schema__schema",
    file__name: "Window",
  },
  schema__browser: {
    db__schema: "schema__schema",
    file__name: "Browser",
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
  // Browser
  history__location: {
    db__schema: "schema__field",
    file__name: "History location ref",
    field__refType: "schema__anyType",
  },
  history__view: {
    db__schema: "schema__field",
    file__name: "History view ref",
    field__refType: "schema__view",
  },
  history__data: {
    db__schema: "schema__field",
    file__name: "History data",
  },
  history__back: {
    db__schema: "schema__field",
    file__name: "History back ref",
    field__refType: "schema__history",
  },
  history__forward: {
    db__schema: "schema__field",
    file__name: "History forward ref",
    field__refType: "schema__history",
  },
  history__window: {
    db__schema: "schema__field",
    file__name: "History window ref",
    field__refType: "schema__window",
  },
  window__currentHistory: {
    db__schema: "schema__field",
    file__name: "Window current history ref",
    field__refType: "schema__history",
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
  rootHistory: {
    db__schema: "schema__history",
    history__window: "rootWindow",
    history__location: "home",
  },
  rootWindow: {
    db__schema: "schema__window",
    window__currentHistory: "rootHistory",
  },
  browser: {
    db__schema: "schema__browser",
    file__name: "Browser state",
    browser__currentWindow: "rootWindow",
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

const db = createSlice({
  name: "db",
  initialState: initDB,
  reducers: {
    push(
      db,
      {
        payload: { windowId, params, historyId },
      }: P<{ windowId: string; params: BrowseParams; historyId: string }>
    ) {
      const window = db[windowId];
      db[window.window__currentHistory!].history__forward = historyId;
      db[historyId] = {
        db__schema: "schema__history",
        history__window: windowId,
        history__location: params.id,
        history__view: params.view,
        history__data: params.data,
        history__back: window.window__currentHistory,
      };
      window.window__currentHistory = historyId;
    },
    replace(
      db,
      {
        payload: { windowId, params },
      }: P<{ windowId: string; params: Partial<BrowseParams> }>
    ) {
      const window = db[windowId];
      const history = db[window.window__currentHistory!];
      if ("id" in params) {
        history.history__location = params.id;
      }
      if ("view" in params) {
        history.history__view = params.view;
      }
      if ("data" in params) {
        history.history__data = params.data;
      }
    },
    back(db, { payload: { windowId } }: P<{ windowId: string }>) {
      const window = db[windowId];
      const currentId = window.window__currentHistory!;
      const backId = db[currentId].history__back;
      if (backId) {
        window.window__currentHistory = backId;
        delete db[currentId].history__back;
        db[backId].history__forward = currentId;
      }
    },
    forward(db, { payload: { windowId } }: P<{ windowId: string }>) {
      const window = db[windowId];
      const currentId = window.window__currentHistory!;
      const forwardId = db[currentId].history__forward;
      if (forwardId) {
        window.window__currentHistory = forwardId;
        delete db[currentId].history__forward;
        db[forwardId].history__back = currentId;
      }
    },
    newWindow(
      db,
      {
        payload: { windowId, params, historyId },
      }: P<{ windowId: string; params: BrowseParams; historyId: string }>
    ) {
      db[windowId] = {
        db__schema: "schema__window",
        window__currentHistory: historyId,
      };
      db[historyId] = {
        db__schema: "schema__history",
        history__window: windowId,
        history__location: params.id,
        history__view: params.view,
        history__data: params.data,
      };
      db.browser.browser__currentWindow = windowId;
    },
    selectWindow(db, { payload: { windowId } }: P<{ windowId: string }>) {
      db.browser.browser__currentWindow = windowId;
    },
    closeWindow(db, { payload: { windowId } }: P<{ windowId: string }>) {
      delete db[windowId];
    },
  },
  selectors: {
    dbGet: (db, id) => db[id],
  },
});

// TODO: index needs to be kept up-to-date
const index = createSlice({
  name: "index",
  initialState: createIndex(initDB),
  reducers: {},
  selectors: {
    indexGet: (idx, id) => idx[id],
    viewersForType: (idx, type) => {
      return idx[type]?.view__schema ?? [];
    },
    viewersForAnyType: (idx) => idx.schema__anyType?.view__schema ?? [],
  },
});

export const actions = {
  ...db.actions,
  push({ windowId, params }: { windowId: string; params: BrowseParams }) {
    const historyId = crypto.randomUUID();
    return db.actions.push({ historyId, windowId, params });
  },
  newWindow({ params }: { params: BrowseParams }) {
    const windowId = crypto.randomUUID();
    const historyId = crypto.randomUUID();
    return db.actions.newWindow({ historyId, windowId, params });
  },
};

export const selectors = {
  db: db.selectSlice,
  ...db.selectors,
  ...index.selectors,
};

export const store = configureStore({
  reducer: { db: db.reducer, index: index.reducer },
});

export type IRootState = ReturnType<typeof store.getState>;
