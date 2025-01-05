import { useContext, createContext, useState, useEffect } from "react";
import "./App.css";

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

type Index = Record<string, Set<string>> & {
  db__schema?: Set<string>;
  view__schema?: Set<string>;
  index__field?: Set<string>;
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

// TODO: constants in query
type Query =
  | { tag: "getRecord"; id: string; value: string }
  | { tag: "getField"; id: string; field: keyof Rec; value: string }
  | { tag: "getIndexedIds"; id: string; field: keyof Rec; value: string }
  | { tag: "checkField"; id: string; field: keyof Rec; value: string };

type Update =
  | { tag: "createRecord"; id: string; value: string }
  | { tag: "setRecord"; id: string; value: string }
  | { tag: "deleteRecord"; id: string }
  | { tag: "setField"; id: string; field: keyof Rec; value: string }
  | { tag: "deleteField"; id: string; field: keyof Rec };

export class QueryBuilder {
  protected boundVars: Set<string>;
  private query: Query[] = [];
  private updates: Update[] = [];
  constructor(params: string[]) {
    this.boundVars = new Set(params);
  }
  q(id: string, field: keyof Rec, value: string): this;
  q(id: string, value: string): this;
  q(id: string, x: string, y?: string) {
    if (y === undefined) {
      if (!this.boundVars.has(id)) throw new Error();
      this.query.push({ tag: "getRecord", id, value: x });
      return this;
    }
    const field = x as keyof Rec;
    const value = y;

    if (this.boundVars.has(id)) {
      if (this.boundVars.has(value)) {
        this.query.push({ tag: "checkField", id, field, value });
      } else {
        this.query.push({ tag: "getField", id, field, value });
        this.boundVars.add(value);
      }
    } else {
      if (this.boundVars.has(value)) {
        this.query.push({ tag: "getIndexedIds", id, field, value });
        this.boundVars.add(id);
      } else {
        throw new Error();
      }
    }
    return this;
  }
  u(id: string, field: keyof Rec, value: string | null): this;
  u(id: string, value: string | null): this;
  u(id: string, x: string | null, y?: string | null) {
    if (!this.boundVars.has(id)) {
      if (x && y === undefined && this.boundVars.has(x)) {
        this.updates.push({ tag: "createRecord", id, value: x });
        this.boundVars.add(id);
        return this;
      }
      console.log({ id, x, y }, this.boundVars);
      throw new Error();
    }
    if (y === undefined) {
      const value = x;
      if (value === null) {
        this.updates.push({ tag: "deleteRecord", id });
      } else {
        if (!this.boundVars.has(value)) throw new Error();
        this.updates.push({ tag: "setRecord", id, value });
      }
      return this;
    }
    const field = x as keyof Rec;
    const value = y;
    if (value === null) {
      this.updates.push({ tag: "deleteField", id, field });
    } else {
      if (!this.boundVars.has(value)) throw new Error();
      this.updates.push({ tag: "setField", id, field, value });
    }
    return this;
  }
  build() {
    return { query: this.query, updates: this.updates };
  }
}

export class Database {
  data: Record<string, Rec> = {};
  index: Record<string, Index> = {};
  private eventListeners: Array<() => void> = [];
  query(builder: QueryBuilder, args: Record<string, unknown>) {
    const { query } = builder.build();
    const out = { ...args };
    for (const q of query) {
      switch (q.tag) {
        case "checkField": {
          const actual = this.data[out[q.id] as string][q.field];
          const expected = out[q.value];
          if (actual !== expected) return null;
          break;
        }
        case "getField": {
          const id = out[q.id] as string;
          out[q.value] = this.data[id][q.field];
          break;
        }
        case "getRecord": {
          const id = out[q.id] as string;
          out[q.value] = this.data[id];
          break;
        }
        case "getIndexedIds": {
          const value = out[q.value] as string;
          out[q.id] = this.index[value][q.field];
          break;
        }
      }
    }
    return out;
  }
  update(builder: QueryBuilder, args: Record<string, unknown>) {
    const out = this.query(builder, args);
    if (!out) throw new Error();
    const { updates } = builder.build();
    for (const u of updates) {
      if (u.tag === "createRecord") {
        const id = crypto.randomUUID();
        out[u.id] = id;
        this.insertRec(id, out[u.value] as Rec);
      } else {
        const id = out[u.id] as string;
        switch (u.tag) {
          case "setRecord":
            this.insertRec(id, out[u.value] as Rec);
            break;
          case "deleteRecord":
            this.deleteRec(id);
            break;
          case "setField":
            this.insertField(id, u.field, out[u.value]);
            break;
          case "deleteField":
            this.deleteField(id, u.field);
        }
      }
    }
    this.notifyEventListeners();
  }
  batchInsert(data: Record<string, Rec>) {
    for (const [key, val] of Object.entries(data)) {
      this.insertRec(key, val);
    }
    this.notifyEventListeners();
  }
  addEventListener(fn: () => void) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  private notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
    }
  }
  private insertField(id: string, field: keyof Rec, value: unknown) {
    const rec = this.data[id] ?? {};
    this.insertRec(id, { ...rec, [field]: value });
  }
  private insertRec(id: string, rec: Rec) {
    this.data[id] = rec;
    this.updateIndex(id);
    if (rec.db__schema === "schema__index") {
      this.addIndex(rec.index__field!);
    }
  }
  private deleteRec(id: string) {
    const old = this.data[id];
    delete this.data[id];
    this.deleteFromIndex(id, old);
  }
  private deleteField(id: string, field: keyof Rec) {
    // TODO: handle if this causes a value to be un-indexed
    const rec = { ...this.data[id] };
    delete rec[field];
    this.insertRec(id, rec);
  }
  private addIndex(field: string) {
    for (const id of Object.keys(this.data)) {
      this.index1(id, field);
    }
  }
  private updateIndex(id: string) {
    for (const indexId of this.index.schema__index?.db__schema ?? []) {
      const field = this.data[indexId].index__field!;
      this.index1(id, field);
    }
  }
  private index1(id: string, field: string) {
    const rec = this.data[id];
    if (field in rec) {
      const items = Array.isArray(rec[field]) ? rec[field] : [rec[field]];
      for (const value of items) {
        this.index[value] ??= {};
        this.index[value][field] ??= new Set();
        this.index[value][field].add(id);
      }
    }
  }
  private deleteFromIndex(id: string, rec: Rec) {
    for (const indexId of this.index.schema__index?.db__schema ?? []) {
      const field = this.data[indexId].index__field!;
      if (field in rec) {
        const items = Array.isArray(rec[field]) ? rec[field] : [rec[field]];
        for (const value of items) {
          this.index[value][field].delete(id);
        }
      }
    }
  }
}

export const database = new Database();
database.batchInsert(initDB);
window.database = database;

const dbContext = createContext(new Database());
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

export function useQuery(b: QueryBuilder, args: Record<string, unknown>) {
  const db = useDB();
  return db.query(b, args);
}

export function useDispatch() {
  const db = useContext(dbContext);
  return function <T>(fn: (db: Database, payload: T) => void, payload: T) {
    fn(db, payload);
  };
}

export const actions = {
  push(
    db: Database,
    { windowId, params }: { windowId: string; params: BrowseParams }
  ) {
    const b = new QueryBuilder(["windowId", "history"])
      .q("windowId", "window__currentHistory", "currentId")
      .u("historyId", "history")
      .u("historyId", "history__back", "currentId")
      .u("windowId", "window__currentHistory", "historyId")
      .u("currentId", "history__forward", "historyId");

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
    db: Database,
    { windowId, params }: { windowId: string; params: Partial<BrowseParams> }
  ) {
    // TODO: optional params?
    const b = new QueryBuilder(["windowId", "id", "view", "data"]) //
      .q("windowId", "window__currentHistory", "currentId");

    if ("id" in params) {
      b.u("currentId", "history__location", "id");
    }
    if ("view" in params) {
      b.u("currentId", "history__view", "view");
    }
    if ("data" in params) {
      b.u("currentId", "history__data", "data");
    }

    db.update(b, { windowId, ...params });
  },
  back(db: Database, { windowId }: { windowId: string }) {
    const b = new QueryBuilder(["windowId"])
      .q("windowId", "window__currentHistory", "currentId")
      .q("currentId", "history__back", "backId")
      .u("windowId", "window__currentHistory", "backId")
      .u("currentId", "history__back", null)
      .u("backId", "history__forward", "currentId");

    db.update(b, { windowId });
  },
  forward(db: Database, { windowId }: { windowId: string }) {
    const b = new QueryBuilder(["windowId"])
      .q("windowId", "window__currentHistory", "currentId")
      .q("currentId", "history__forward", "forwardId")
      .u("windowId", "window__currentHistory", "forwardId")
      .u("currentId", "history__forward", null)
      .u("forwardId", "history__back", "currentId");

    db.update(b, { windowId });
  },
  newWindow(db: Database, { params }: { params: BrowseParams }) {
    const b = new QueryBuilder(["browser", "window", "history"])
      .u("windowId", "window")
      .u("historyId", "history")
      .u("browser", "browser__currentWindow", "windowId")
      .u("windowId", "window__currentHistory", "historyId")
      .u("historyId", "history__window", "windowId");

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
  selectWindow(db: Database, { windowId }: { windowId: string }) {
    const b = new QueryBuilder(["browser", "windowId"]) //
      .u("browser", "browser__currentWindow", "windowId");
    db.update(b, { browser: "browser", windowId });
  },
  closeWindow(db: Database, { windowId }: { windowId: string }) {
    // TODO: must update current window
    const b = new QueryBuilder(["windowId"]) //
      .u("windowId", null);
    db.update(b, { windowId });
  },
};

export const selectors = {
  viewersForType(db: Database, type: string) {
    return [...(db.index[type]?.view__schema ?? [])];
  },
  viewersForAnyType(db: Database) {
    return [...(db.index.schema__anyType?.view__schema ?? [])];
  },
};
