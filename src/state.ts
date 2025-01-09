import { useContext, createContext, useState, useEffect } from "react";
import "./App.css";
import { DB, q, Query } from "./db";
import { k, or } from "./expr";
import {
  FormatTextBuilder,
  FormatTextNode,
  ViewBuilder,
  ViewElement,
} from "./view";

type Id = string;
type SchemaId =
  | "schema__anyType"
  | "schema__schema"
  | "schema__view"
  | "schema__field"
  | "schema__rule"
  | "schema__text"
  | "schema__folder"
  | "schema__history"
  | "schema__window"
  | "schema__browser";

// TODO enum
type ViewPrimitive = string;

export type Rec = {
  file__name?: string;
  file__description?: string;
  file__folderItems?: Id[];
  text__content?: FormatTextNode[];
  db__schema?: SchemaId;
  field__refType?: Id;
  field__index?: "ref"; // "multiRef" | "unique" | "sorted"
  rule__id?: Id;
  rule__query?: Query;
  view__primitive?: ViewPrimitive;
  view__elements?: ViewElement[];
  view__schema?: SchemaId;
  view__query?: Query;
  history__window?: Id;
  history__location?: Id;
  history__view?: Id;
  history__data?: Record<string, string>;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;
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
  schema__rule: {
    db__schema: "schema__schema",
    file__name: "Rule",
  },
  // fields
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: "schema used to validate & render this record",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  field__refType: {
    db__schema: "schema__field",
    file__name: "Field refType",
    file__description:
      "if this is set, the value of this field is a ref to a record with this schema",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  field__index: {
    db__schema: "schema__field",
    file__name: "Field index",
    file__description:
      "If set, the field is indexed using an index of this type.",
  },
  view__primitive: {
    db__schema: "schema__field",
    file__name: "View component",
    file__description: "name of the primitive component used for rendering",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View schema",
    file__description: "the schema that this view is supposed to render",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  view__elements: {
    db__schema: "schema__field",
    file__name: "View elements",
    file__description: "list of elements with params for UI",
  },
  view_query: {
    db__schema: "schema__field",
    file__name: "View query",
    file__description: "query populates data for view",
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
    field__index: "ref",
  },
  // TODO: unique index
  rule__id: {
    db__schema: "schema__field",
    file__name: "Rule id",
  },
  rule__query: {
    db__schema: "schema__field",
    file__name: "Rule query",
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
  // Rules
  rule__push: {
    db__schema: "schema__rule",
    rule__id: "push",
    rule__query: q("windowId", "id", "view", "data")
      .get("windowId", "window__currentHistory", "currentId")
      .id("h")
      .update("h", "db__schema", k("schema__history"))
      .update("h", "history__window", "windowId")
      .update("h", "history__location", "id")
      .update("h", "history__view", "view")
      .update("h", "history__data", "data")
      .update("h", "history__back", "currentId")
      .update("windowId", "window__currentHistory", "h")
      .update("currentId", "history__forward", "h"),
  },
  rule__replace: {
    db__schema: "schema__rule",
    rule__id: "replace",
    rule__query: q("windowId", "id", "view", "data")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__location", "_id")
      .update("currentId", "history__location", or("id", "_id"))
      .get("currentId", "history__view", "_view")
      .update("currentId", "history__view", or("view", "_view"))
      .get("currentId", "history__data", "_data")
      .update("currentId", "history__data", or("data", "_data")),
  },
  rule__back: {
    db__schema: "schema__rule",
    rule__id: "back",
    rule__query: q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__back", "backId")
      .update("windowId", "window__currentHistory", "backId")
      .update("currentId", "history__back", k(null))
      .update("backId", "history__forward", "currentId"),
  },
  rule__forward: {
    db__schema: "schema__rule",
    rule__id: "forward",
    rule__query: q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__forward", "forwardId")
      .update("windowId", "window__currentHistory", "forwardId")
      .update("currentId", "history__forward", k(null))
      .update("forwardId", "history__back", "currentId"),
  },
  rule__newWindow: {
    db__schema: "schema__rule",
    rule__id: "newWindow",
    rule__query: q("id", "view", "data")
      .id("w")
      .id("h")
      .update(k("browser"), "browser__currentWindow", "w")
      .update("w", "db__schema", k("schema__window"))
      .update("w", "window__currentHistory", "h")
      .update("h", "db__schema", k("schema__history"))
      .update("h", "history__window", "w")
      .update("h", "history__location", "id")
      .update("h", "history__view", "view")
      .update("h", "history__data", "data"),
  },
  rule__selectWindow: {
    db__schema: "schema__rule",
    rule__id: "selectWindow",
    rule__query: q("windowId") //
      .update(k("browser"), "browser__currentWindow", "windowId"),
  },
  rule__closeWindow: {
    db__schema: "schema__rule",
    rule__id: "closeWindow",
    rule__query: q("windowId") //
      .insert("windowId", k(null))
      .update(k("browser"), "browser__currentWindow", k(null)),
  },
  // Views
  view__anyType: {
    db__schema: "schema__view",
    file__name: "DataView",
    file__description: "default viewer for all data types",
    view__primitive: "DataView",
    view__schema: "schema__anyType",
  },
  view__text: {
    db__schema: "schema__view",
    file__name: "Text",
    file__description: "viewer for text cards",
    view__schema: "schema__text",
    view__query: q("id") //
      .get("id", "text__content", "content"),
    view__elements: new ViewBuilder() //
      .view(k("view__textContent"), { text: "content" })
      .build(),
  },
  view__folderList: {
    db__schema: "schema__view",
    file__name: "Folder - List",
    file__description: "viewer for folders as list",
    view__schema: "schema__folder",
    view__query: q("id") //
      .get("id", "file__folderItems", "items")
      .members("item", "items")
      .get("item", "file__name", "name")
      .get("item", "file__description", "description"),
    view__elements: new ViewBuilder()
      .link("name", "item")
      .string("description")
      .build(),
  },
  view__folderIcon: {
    db__schema: "schema__view",
    file__name: "Folder - Icon",
    file__description: "viewer for folders as icon grid",
    view__schema: "schema__folder",
    view__query: q("id") //
      .get("id", "file__folderItems", "items")
      .members("item", "items")
      .get("item", "file__name", "name"),
    view__elements: new ViewBuilder()
      .view(k("view__icon"), {})
      .link("name", "item")
      .build(),
  },
  view__schemaDefinition: {
    db__schema: "schema__view",
    file__name: "Schema",
    view__schema: "schema__schema",
    view__query: q("id") //
      .get("id", "file__name", "name"),
    view__elements: new ViewBuilder()
      .view(k("view__fileInfo"), { id: "id" })
      .link(k("click me"), k("home"))
      .build(),
  },
  view__fileInfo: {
    db__schema: "schema__view",
    file__name: "File Info",
    view__query: q("id")
      .get("id", "file__name", "name")
      .get("id", "file__description", "description"),
    view__elements: new ViewBuilder()
      .string(k("id"))
      .string("id")
      .string(k("name"))
      .string("name")
      .string(k("description"))
      .string("description")
      .build(),
  },
  view__string: {
    db__schema: "schema__view",
    file__name: "String",
    view__primitive: "PrimitiveString",
  },
  view__link: {
    db__schema: "schema__view",
    file__name: "Link",
    view__primitive: "PrimitiveLink",
  },
  view__icon: {
    db__schema: "schema__view",
    file__name: "Icon",
    view__primitive: "IconView",
  },
  view__textContent: {
    db__schema: "schema__view",
    file__name: "Text Content",
    view__primitive: "TextView",
  },
  // Cards
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: "this is the home card",
    text__content: new FormatTextBuilder()
      .text("content that ")
      .link({ id: "other" }, "links")
      .text(" to another card.")
      .build(),
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
    db__schema: "omnibox" as SchemaId,
    file__name: "Omnibox",
    view__primitive: "OmniboxView",
    view__schema: "omnibox" as SchemaId,
  },
};

export const database = new DB<Rec>();
database.bulkInsert(initDB);

const dbContext = createContext(new DB<Rec>());
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
  return function (rule: string, args: Record<string, unknown> = {}) {
    const keys = Object.keys(args);
    const pairs = Object.fromEntries(keys.map((k) => [k, k]));
    const query = q(...Object.keys(args)).rule(rule, pairs);
    db.update(query, args);
  };
}
