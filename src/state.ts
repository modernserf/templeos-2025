import { useState, useEffect } from "react";
import { DB } from "./db";
import { EventSource, QueryState, Runtime } from "./runtime";
import { k, or } from "./expr";
import { FormatTextBuilder, views } from "./view";
import { fields, Rec, schemas } from "./schema";
import { q, Query } from "./query";
import { flatMap } from "./iter";

export type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
};

const initDB = {
  ...schemas,
  ...fields,
  ...views,
  // Rules
  rule__push: {
    db__schema: "schema__rule",
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
    rule__query: q("windowId") //
      .update(k("browser"), "browser__currentWindow", "windowId")
      .build(),
  },
  rule__closeWindow: {
    db__schema: "schema__rule",
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
  omnibox: {
    db__schema: "schema__form",
    file__name: "Omnibox",
    view__query: q().build(),
    view__primitive: "OmniboxView",
  },
} satisfies Record<string, Rec>;

export const eventSource = new EventSource();
export const db = new DB();
export const runtime = new Runtime(db, eventSource);
runtime.bulkInsert(initDB);

declare global {
  interface Window {
    runtime: Runtime;
  }
}

window.runtime = runtime;

// this triggers a re-render on every update
export function useDB() {
  const [, setData] = useState({});
  useEffect(() => {
    return eventSource.addEventListener(() => {
      setData({});
    });
  }, []);
  return QueryState.root();
}

export function useQueryView(
  state: QueryState,
  b: Query,
  args: Record<string, unknown> = {}
) {
  return flatMap(function* (item) {
    if (item.tag === "viewPrimitive") yield item;
  }, runtime.query(state.update(b, args)));
}

export function useQueryResult<T>(
  state: QueryState,
  b: Query,
  args: Record<string, unknown> = {}
) {
  return flatMap(function* (item) {
    if (item.tag === "result") yield item.value as T;
  }, runtime.query(state.update(b, args)));
}

export function useEventHandler(state: QueryState) {
  return function (query: Query, args: Record<string, unknown> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of runtime.query(state.eventHandler(query, args))) {
      // empty
    }
  };
}
