import { Rec } from ".";
import { l, s, $, f, __ } from "../expr";
import { pkg } from "../pkg";

export const collectionData = pkg("collection", {
  // schemas
  folder: {
    db__schema: "schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    schema__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  tag: {
    db__schema: "schema",
    file__name: "Tag",
    file__description: l(
      "Tags are used to organize records. A record can have and belongs to many tags.",
    ),
    schema__fields: l(s.field("file__name")),
  },
  // fields
  _folder_items: {
    db__schema: "field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    db__type: "multi_ref",
    db__index: s.multiRef(),
    rule__params: l($.items, $.id),
    rule__body: f._folder_items($.id, $.items),
  },
  _tags: {
    db__schema: "field",
    file__name: "File tags",
    file__description: l("The list of tags associated with a record."),
    db__type: "multi_ref",
    db__index: s.multiRef(),
  },
  _tag_files: {
    rule__params: l($.files, $.tag),
    rule__body: s.collect_item_in($.files, $.file, f._tags($.file, $.tag)),
  },
  _file_desc: {
    rule__params: l($.desc, $.id),
    rule__body: f.file__description($.id, $.desc),
  },

  _view_list: {
    rule__params: l($.out, $.collection, $.id),
    rule__body: s.column(
      $.out,
      l(),
      s.dot(s._file_desc($.id), s.view__text()),
      s.expr_iter(
        s($.item).in($.collection),
        s.row(l(), s.view__file_info($.item)),
      ),
    ),
  },
  _view_icons: {
    rule__params: l($.out, $.collection, $.id),
    rule__body: s.column(
      $.out,
      l(),
      s.dot(s._file_desc($.id), s.view__text()),
      s.row(
        l(),
        s.expr_iter(
          s($.item).in($.collection),
          s.column(l(), s.view__icon(), s.view__file_link($.item)),
        ),
      ),
    ),
  },

  _folder_list: {
    file__name: "Folder - List",
    view__schema: "folder",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._folder_items($.id), s._view_list($.id)),
  },
  _folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "folder",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._folder_items($.id), s._view_icons($.id)),
  },
  _tag_list: {
    file__name: "Tag - List",
    view__schema: "tag",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._tag_files($.id), s._view_list($.id)),
  },
  _tag_icon: {
    file__name: "Tag - Icon",
    view__schema: "tag",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._tag_files($.id), s._view_icons($.id)),
  },
});

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
    collection__tags: l("example_tag"),
    collection__folder_items: l("home"),
  },
} satisfies Record<string, Rec>;
