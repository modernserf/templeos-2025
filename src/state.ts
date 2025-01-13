import { useContext, createContext, useState, useEffect } from "react";
import { DB } from "./db";
import { Runtime } from "./runtime";
import { k, or } from "./expr";
import { FormatTextBuilder, views } from "./view";
import { fields, Rec, schemas } from "./schema";
import { q, Query } from "./query";

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

export type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
};

const initDB: Record<string, Rec> = {
  ...schemas,
  ...fields,
  ...views,
  // Rules
  rule__push: {
    db__schema: "schema__rule",
    rule__id: "push",
    rule__query: q("windowId", "id", "view", "data")
      .get("windowId", "window__currentHistory", "currentId")
      .id("h")
      .timestamp("ts")
      .update("h", "db__schema", k("schema__history"))
      .update("h", "history__window", "windowId")
      .update("h", "history__location", "id")
      .update("h", "history__view", "view")
      .update("h", "history__data", "data")
      .update("h", "history__back", "currentId")
      .update("h", "time__created", "ts")
      .update("windowId", "window__currentHistory", "h")
      .update("currentId", "history__forward", "h")
      .build(),
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
      .update("currentId", "history__data", or("data", "_data"))
      .build(),
  },
  rule__back: {
    db__schema: "schema__rule",
    rule__id: "back",
    rule__query: q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__back", "backId")
      .update("windowId", "window__currentHistory", "backId")
      .update("currentId", "history__back", k(null))
      .update("backId", "history__forward", "currentId")
      .build(),
  },
  rule__forward: {
    db__schema: "schema__rule",
    rule__id: "forward",
    rule__query: q("windowId")
      .get("windowId", "window__currentHistory", "currentId")
      .get("currentId", "history__forward", "forwardId")
      .update("windowId", "window__currentHistory", "forwardId")
      .update("currentId", "history__forward", k(null))
      .update("forwardId", "history__back", "currentId")
      .build(),
  },
  rule__newWindow: {
    db__schema: "schema__rule",
    rule__id: "newWindow",
    rule__query: q("id", "view", "data")
      .id("w")
      .id("h")
      .timestamp("ts")
      .update(k("browser"), "browser__currentWindow", "w")
      .update("w", "db__schema", k("schema__window"))
      .update("w", "window__currentHistory", "h")
      .update("h", "db__schema", k("schema__history"))
      .update("h", "history__window", "w")
      .update("h", "history__location", "id")
      .update("h", "history__view", "view")
      .update("h", "history__data", "data")
      .update("h", "time__created", "ts")
      .build(),
  },
  rule__selectWindow: {
    db__schema: "schema__rule",
    rule__id: "selectWindow",
    rule__query: q("windowId") //
      .update(k("browser"), "browser__currentWindow", "windowId")
      .build(),
  },
  rule__closeWindow: {
    db__schema: "schema__rule",
    rule__id: "closeWindow",
    rule__query: q("windowId") //
      .insert("windowId", k(null))
      .update(k("browser"), "browser__currentWindow", k(null))
      .build(),
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
    view__query: q().build(),
    view__primitive: "OmniboxView",
    view__schema: "omnibox" as SchemaId,
  },
};

export const runtime = new Runtime(new DB());
runtime.bulkInsert(initDB);

declare global {
  interface Window {
    runtime: Runtime;
  }
}

window.runtime = runtime;

const dbContext = createContext(runtime);
export const DBProvider = dbContext.Provider;

// TODO: separate query / command handlers
function useDB() {
  const db = useContext(dbContext);
  const [data, setData] = useState({ db });
  useEffect(() => {
    return db.addEventListener(() => {
      setData({ db });
    });
  }, [db]);
  return data.db;
}

export function useRender(b: Query, args?: Record<string, unknown>) {
  const db = useDB();
  return db.render(b, args);
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
    const query = q(...Object.keys(args))
      .rule(rule, pairs)
      .build();
    db.update(query, args);
  };
}
