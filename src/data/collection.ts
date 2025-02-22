import { Rec } from ".";
import { l, s, $, f, seq, __ } from "../expr";
import { db } from "./db";

export const collectionData = {
  // schemas
  folder: {
    db__schema: "schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    db__fields: l(db.field("rule__params"), db.field("rule__body")),
  },
  tag: {
    db__schema: "schema",
    file__name: "Tag",
    file__description: l(
      "Tags are used to organize records. A record can have and belongs to many tags.",
    ),
    db__fields: l(db.field("file__name")),
  },
  // fields
  folder__items: {
    db__schema: "field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    db__type: "multi_ref",
    db__index: s.multiRef(),
  },
  file__tags: {
    db__schema: "field",
    file__name: "File tags",
    file__description: l("The list of tags associated with a record."),
    db__type: "multi_ref",
    db__index: s.multiRef(),
  },

  view__collection_list: {
    rule__params: l($.out, $.id, $.collection),
    rule__body: s.column(
      $.out,
      l(),
      s.expr_iter(f.file__description($.id, $.desc), s.view__text($.desc)),
      s.expr_iter(
        s.value_box_index($.item, $.collection, __),
        s.row(l(), s.view__file_info($.item)),
      ),
    ),
  },
  view__collection_icon: {
    rule__params: l($.out, $.id, $.collection),
    rule__body: s.column(
      $.out,
      l(),
      s.expr_iter(f.file__description($.id, $.desc), s.view__text($.desc)),
      s.row(
        l(),
        s.expr_iter(
          s.value_box_index($.item, $.collection, __),
          s.column(l(), s.view__icon(), s.view__file_link($.item)),
        ),
      ),
    ),
  },

  //
  view__folder_list: {
    file__name: "Folder - List",
    view__schema: "folder",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      f.folder__items($.id, $.items),
      s.view__collection_list($.out, $.id, $.items),
    ),
  },
  view__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "folder",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      f.folder__items($.id, $.items),
      s.view__collection_icon($.out, $.id, $.items),
    ),
  },

  view__tag_list: {
    file__name: "Tag - List",
    view__schema: "tag",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.collect_item_in($.items, $.file, f.file__tags($.file, $.id)),
      s.view__collection_list($.out, $.id, $.items),
    ),
  },
  view__tag_icon: {
    file__name: "Tag - Icon",
    view__schema: "tag",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.collect_item_in($.items, $.file, f.file__tags($.file, $.id)),
      s.view__collection_icon($.out, $.id, $.items),
    ),
  },
} satisfies Record<string, Rec>;

export const collectionInitState = {
  // items
  example_tag: {
    db__schema: "tag",
    file__name: "Example Tag",
    file__description: l("A tag with some items"),
  },
  example__folder: {
    db__schema: "folder",
    file__name: "Example Folder",
    file__description: l("A folder with some items"),
    file__tags: l("example_tag"),
    folder__items: l("home"),
  },
} satisfies Record<string, Rec>;
