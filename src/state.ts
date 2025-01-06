import { useContext, createContext, useState, useEffect } from "react";
import "./App.css";
import { DB, q, Query } from "./db";

export type TextNode =
  | {
      tag: "text";
      text: string;
    }
  | { tag: "link"; text: string; params: BrowseParams };

export type Expr =
  | { tag: "string"; value: string }
  | { tag: "ident"; value: string }
  | { tag: "field"; expr: Expr; field: string };

// TODO: card els all in { id, params } format
export type CardEl =
  | { tag: "text"; expr: Expr } //
  | { tag: "button"; label: Expr };

export type Rec = {
  file__name?: string;
  file__description?: string;
  file__folderItems?: string[];
  text__content?: TextNode[];
  db__schema?: string;
  field__refType?: string;
  index__field?: string;
  view__component?: string;
  view__cardElements?: CardEl[];
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

export type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
};

const initDB: Record<string, Rec> = {
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
  view__cardElements: {
    db__schema: "schema__field",
    file__name: "View card elements",
    file__description: "list of elements with params for Card UI",
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
    file__name: "Text",
    file__description: "viewer for text cards",
    view__component: "TextView",
    view__schema: "schema__text",
  },
  view__folderList: {
    db__schema: "schema__view",
    file__name: "Folder - List",
    file__description: "viewer for folders as list",
    view__component: "FolderListView",
    view__schema: "schema__folder",
  },
  view__folderIcon: {
    db__schema: "schema__view",
    file__name: "Folder - Icon",
    file__description: "viewer for folders as icon grid",
    view__component: "FolderIconView",
    view__schema: "schema__folder",
  },
  view__schemaDefinition: {
    db__schema: "schema__view",
    file__name: "Schema",
    view__component: "CardView",
    view__schema: "schema__schema",
    view__cardElements: [
      { tag: "text", expr: { tag: "string", value: "Schema!" } },
      {
        tag: "text",
        expr: { tag: "ident", value: "id" },
      },
      { tag: "button", label: { tag: "string", value: "click me" } },
    ],
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

export const database = new DB();
database.bulkInsert(initDB);

const dbContext = createContext(new DB());
export const DBProvider = dbContext.Provider;

// TODO: separate query / command handlers
export function useDB() {
  const db = useContext(dbContext);
  const [data, setData] = useState({ db });
  useEffect(() => {
    return db.addEventListener(() => {
      setData({ db });
    });
  }, [db]);
  return data.db;
}

export function useQuery(b: Query, args?: Record<string, unknown>) {
  const db = useDB();
  return db.query1(b, args);
}

export function useQueryAll(b: Query, args?: Record<string, unknown>) {
  const db = useDB();
  return db.queryAll(b, args);
}

export function useDispatch() {
  const db = useContext(dbContext);
  return function <T>(fn: (db: DB, payload: T) => void, payload: T) {
    fn(db, payload);
  };
}

export const actions = {
  push(
    db: DB,
    { windowId, params }: { windowId: string; params: BrowseParams }
  ) {
    const b = q("windowId", "history")
      .get("windowId", "window__currentHistory", "currentId")
      .id("historyId")
      .insert("historyId", "history")
      .update("historyId", "history__back", "currentId")
      .update("windowId", "window__currentHistory", "historyId")
      .update("currentId", "history__forward", "historyId");

    db.update(b, {
      windowId,
      history: {
        db__schema: "schema__history",
        history__window: windowId,
        history__location: params.id,
        history__view: params.view,
        history__data: params.data,
      },
    });
  },
  replace(
    db: DB,
    { windowId, params }: { windowId: string; params: Partial<BrowseParams> }
  ) {
    // TODO: optional params?
    const b = q("windowId", "id", "view", "data") //
      .get("windowId", "window__currentHistory", "currentId");

    if ("id" in params) {
      b.update("currentId", "history__location", "id");
    }
    if ("view" in params) {
      b.update("currentId", "history__view", "view");
    }
    if ("data" in params) {
      b.update("currentId", "history__data", "data");
    }

    db.update(b, { windowId, ...params });
  },
  back(db: DB, { windowId }: { windowId: string }) {
    const b = q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__back", "backId")
      .update("windowId", "window__currentHistory", "backId")
      .deleteField("currentId", "history__back")
      .update("backId", "history__forward", "currentId");

    db.update(b, { windowId });
  },
  forward(db: DB, { windowId }: { windowId: string }) {
    const b = q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__forward", "forwardId")
      .update("windowId", "window__currentHistory", "forwardId")
      .deleteField("currentId", "history__forward")
      .update("forwardId", "history__back", "currentId");

    db.update(b, { windowId });
  },
  newWindow(db: DB, { params }: { params: BrowseParams }) {
    const b = q("browser", "window", "history")
      .id("windowId")
      .insert("windowId", "window")
      .id("historyId")
      .insert("historyId", "history")
      .update("browser", "browser__currentWindow", "windowId")
      .update("windowId", "window__currentHistory", "historyId")
      .update("historyId", "history__window", "windowId");

    db.update(b, {
      browser: "browser",
      window: {
        db__schema: "schema__window",
      },
      history: {
        db__schema: "schema__history",
        history__location: params.id,
        history__view: params.view,
        history__data: params.data,
      },
    });
  },
  selectWindow(db: DB, { windowId }: { windowId: string }) {
    const b = q("browser", "windowId") //
      .update("browser", "browser__currentWindow", "windowId");
    db.update(b, { browser: "browser", windowId });
  },
  closeWindow(db: DB, { windowId }: { windowId: string }) {
    // TODO: must update current window
    const b = q("windowId") //
      .deleteRecord("windowId");
    db.update(b, { windowId });
  },
};
