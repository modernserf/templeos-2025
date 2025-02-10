import { dbf } from "./core";
import { Rec } from ".";
import { l, s, $, r, view, __ } from "../expr";
import { db } from "./db";

export const tagData = {
  // schema
  tag: {
    db__schema: "schema",
    file__name: "Tag",
    file__description: l(
      "Tags are used to organize records. A record can have and belongs to many tags.",
    ),
    db__fields: l(dbf.field("file__name")),
  },
  // field
  file__tags: {
    db__schema: "field",
    file__name: "File tags",
    file__description: l("The list of tags associated with a record."),
    db__type: "multi_ref",
    db__index: s.multiRef(),
    db__default_view: "view__file__tags",
  },

  // views
  view__tag_edit: {
    rule__params: l($.tag, $.on_delete, $.out),
    rule__body: r(
      view.button(
        l(s.class("DeleteExpr")),
        "x",
        l(s.click(__), $.on_delete),
        $.button,
      ),
      view.file_link($.tag, $.link),
      view.row(l(), l($.button, $.link), $.out),
    ),
  },
  view__add_tag_menu: {
    rule__params: l($.selected, $.on_add, $.out),
    rule__body: r(
      s.collect(
        s.option($.tag_opt, $.name),
        r(s.db__schema($.tag_opt, "tag"), s.file__name($.tag_opt, $.name)),
        $.tag_opts,
      ),
      view.menu(
        "Add tag",
        $.tag_opts,
        l(s.change($.selected), $.on_add),
        $.out,
      ),
    ),
  },
  view__file__tags: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      s.collect(
        $.view,
        s.fork(
          r(
            s.file__tags($.id, $.tag),
            view.tag_edit(
              $.tag,
              db.with_tx($.tx, db.delete($.tx, $.id, "file__tags", $.tag)),
              $.view,
            ),
          ),
          view.spacer("0.25rem", $.view),
          view.add_tag_menu(
            $.selected,
            db.with_tx($.tx, db.update($.tx, $.id, "file__tags", $.selected)),
            $.view,
          ),
        ),
        $.row,
      ),
      view.row(l(), $.row, $.out),
    ),
  },
  view__tag: {
    file__name: "Tag items",
    view__schema: "tag",
    rule__params: l($.tag, $.state, $.out),
    rule__body: r(
      s.file__description($.tag, $.desc),
      view.text($.desc, $.header),
      s.collect(
        $.view,
        r(s.file__tags($.file, $.tag), view.file_info($.file, $.view)),
        $.tags,
      ),
      view.column(l(), $.tags, $.tag_section),
      view.column(l(), l($.header, $.tag_section), $.out),
    ),
  },
} satisfies Record<string, Rec>;
