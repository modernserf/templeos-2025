import { views } from "./view";
import { fields, indexTypes, Rec, schemas } from "./schema";
import { k, R, v } from "./rule_builder";
import { FormatTextBuilder } from "./format_text_builder";
import { rulePrimitiveRecs } from "./rule_primitive";

export const initDB = {
  ...schemas,
  ...fields,
  ...indexTypes,
  ...views,
  ...rulePrimitiveRecs,
  rule__getData: R("field", "data")
    .getContext("windowId", "windowId")
    .get("windowId", "window__currentHistory", "h")
    .get("h", v("field"), "data")
    .build(),
  rule__setData: R("field", "data")
    .getContext("windowId", "windowId")
    .get("windowId", "window__currentHistory", "h")
    .update("h", v("field"), "data")
    .build(),
  rule__push: R("windowId", "id", "view")
    .get("windowId", "window__currentHistory", "currentId")
    .id("h")
    .timestamp("ts")
    .update("h", "db__schema", k("schema__history"))
    .update("h", "history__window", "windowId")
    .update("h", "history__location", "id")
    .update("h", "history__view", "view")
    .update("h", "history__back", "currentId")
    .update("h", "time__created", "ts")
    .update("windowId", "window__currentHistory", "h")
    .update("currentId", "history__forward", "h")
    .build(),
  rule__replace: R("windowId", "id", "view")
    .get("windowId", "window__currentHistory", "currentId")
    .update("currentId", "history__location", "id")
    .update("currentId", "history__view", "view")
    .build(),
  rule__back: R("windowId")
    .get("windowId", "window__currentHistory", "currentId")
    .get("currentId", "history__back", "backId")
    .update("windowId", "window__currentHistory", "backId")
    .update("currentId", "history__back", k(null))
    .update("backId", "history__forward", "currentId")
    .build(),
  rule__forward: R("windowId")
    .get("windowId", "window__currentHistory", "currentId")
    .get("currentId", "history__forward", "forwardId")
    .update("windowId", "window__currentHistory", "forwardId")
    .update("currentId", "history__forward", k(null))
    .update("forwardId", "history__back", "currentId")
    .build(),
  rule__newWindow: R("id", "view")
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
    .update("h", "time__created", "ts")
    .build(),
  rule__selectWindow: R("windowId")
    .update(k("browser"), "browser__currentWindow", "windowId")
    .build(),
  rule__closeWindow: R("windowId")
    .insert("windowId", k(null))
    .update(k("browser"), "browser__currentWindow", k(null))
    .build(),

  // Cards
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: "this is the home card",
    text__content: new FormatTextBuilder()
      .text("content that ")
      .link({ id: "example__folder" }, "links")
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
} satisfies Record<string, Rec>;
