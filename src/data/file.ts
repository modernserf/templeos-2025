import { Rec } from ".";
import { l, s, $, f, __, seq, x } from "../expr";
import { pkg } from "../pkg";

export const collectionData = pkg("file", {
  // schemas
  folder: {
    db__schema: "schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    schema__fields: l(s.field("_folder_items")),
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
  file__name: {
    db__schema: "field",
    file__name: "File name",
    file__description: l("field used for name in tab header & file explorer"),
    field__type: s.string(),
  },
  file__description: {
    db__schema: "field",
    file__name: "File description",
    file__description: l("describes the content of the record"),
    field__type: x.text(),
  },
  _folder_items: {
    db__schema: "field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    field__type: x.list_of(s.ref(__)),
    field__index: s.multi_ref(),
    rule__params: l($.items, $.id),
    rule__body: f._folder_items($.id, $.items),
  },
  _tags: {
    db__schema: "field",
    file__name: "File tags",
    file__description: l("The list of tags associated with a record."),
    field__type: x.list_of(s.ref(__)),
    field__index: s.multi_ref(),
  },
  _tag_files: {
    rule__params: l($.files, $.tag),
    rule__body: s.collect_item_in($.files, $.file, f._tags($.file, $.tag)),
  },
  _file_desc: {
    rule__params: l($.desc, $.id),
    rule__body: f.file__description($.id, $.desc),
  },

  _view_table: {
    rule__params: l($.out, $.collection),
    // TODO: sort columns
    rule__body: s.table(
      $.out,
      l(),
      s.table_section(
        l(),
        l(
          s.view__string("Name"),
          s.view__string("Schema"),
          s.view__string("Description"),
        ),
        s.expr_iter(
          s($.item).in($.collection),
          s.table_row(
            l(),
            s.view__file_link($.item),
            s.expr_iter_else(
              f.db__schema($.item, $.schema),
              l(s.view__file_link($.schema)),
              l(s.view__string("")),
            ),
            s.expr_iter_else(
              f.file__description($.item, $.desc),
              l(s.view__text($.desc)),
              l(s.view__string("")),
            ),
          ),
        ),
      ),
    ),
  },

  _view_list: {
    rule__params: l($.out, $.collection, $.id),
    rule__body: s.column(
      $.out,
      l(),
      s.dot(s._file_desc($.id), s.view__text()),
      s._view_table($.collection),
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
    view__subject: s.schema("folder"),
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._folder_items($.id), s._view_list($.id)),
  },
  _folder_icon: {
    file__name: "Folder - Icon",
    view__subject: s.schema("folder"),
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._folder_items($.id), s._view_icons($.id)),
  },
  _tag_list: {
    file__name: "Tag - List",
    view__subject: s.schema("tag"),
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._tag_files($.id), s._view_list($.id)),
  },
  _tag_icon: {
    file__name: "Tag - Icon",
    view__subject: s.schema("tag"),
    rule__params: l($.out, $.id, $.state),
    rule__body: s.dot($.out, s._tag_files($.id), s._view_icons($.id)),
  },

  view__file_link: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s.value_record_field_default($.name, $.id, "file__name", $.id),
      s.view__link($.out, l(), $.name, s.location($.id)),
    ),
  },
  view__file_info: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.row(
          l(),
          s.expr_iter(
            f.db__schema($.id, $.schema),
            s.view__file_link($.schema),
            s.view__string(":"),
            s.view__spacer("0.5rem"),
          ),
          s.view__file_link($.id),
        ),
        s.expr_iter(f.file__description($.id, $.desc), s.view__text($.desc)),
      ),
    ),
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
    file__tags: l("example_tag"),
    file__folder_items: l("home"),
  },
} satisfies Record<string, Rec>;
