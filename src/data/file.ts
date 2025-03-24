import { l, s, $, __, seq, x, xfn, alt, u, fn } from "../expr";
import { pkg } from "../pkg";

export const { rules: collectionData } = pkg("file", {
  // schemas
  tag: {
    db__schema: "schema",
    file__name: "Tag",
    file__description: l(
      "Tags are used to organize records. A record can have and belongs to many tags.",
    ),
    schema__fields: l(s.field("_name")),
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
    field__type: s.text(),
  },
  _tags: {
    db__schema: "field",
    file__name: "File tags",
    file__description: l("The list of tags associated with a record."),
    field__type: s.list_of(s.t_ref(__)),
    field__index: s.multi_ref(),
  },
  _tag_files: {
    rule__params: l($.files, $.tag),
    rule__body: s.collect_item_in($.files, $.file, s._tags($.tag, $.file)),
  },

  _view_table: {
    rule__params: l($.out, $.collection),
    // TODO: sort columns
    rule__body: s.table(
      $.out,
      l(),
      x.table_section(
        x.table_header(l(), "Name", "Schema", "Description"),
        xfn($.out)(
          s($.item).in($.collection),
          s.table_row(
            $.out,
            l(),
            x.view__file_link($.item),
            x.result_if(
              s.db__schema($.schema, $.item),
              s.view__file_link($.schema),
              "",
            ),
            x._view_description($.item),
          ),
        ),
      ),
    ),
  },
  _view_description: {
    rule__params: l($.out, $.id),
    rule__body: s.if_then_else(
      s._description($.desc, $.id),
      s.view__text($.out, $.desc),
      s.view__text($.out, l()),
    ),
  },

  _view_list: {
    rule__params: l($.out, $.collection, $.id),
    rule__body: s.column(
      $.out,
      l(),
      x._view_description($.id),
      x._view_table($.collection),
    ),
  },
  _view_icons: {
    rule__params: l($.out, $.collection, $.id),
    rule__body: s.column(
      $.out,
      l(),
      x._view_description($.id),
      x.row(
        l(),
        xfn($.u)(
          s($.item).in($.collection),
          s.column($.u, l(), x.view__icon(), x.view__file_link($.item)),
        ),
      ),
    ),
  },
  _tag_list: {
    db__schema: "view",
    file__name: "Tag - List",
    view__subject: s.schema("tag"),
    rule__params: l($.out, $.id, $._state),
    rule__body: s._view_list($.out, x._tag_files($.id), $.id),
  },
  _tag_icon: {
    db__schema: "view",
    file__name: "Tag - Icon",
    view__subject: s.schema("tag"),
    rule__params: l($.out, $.id, $._state),
    rule__body: s._view_icons($.out, x._tag_files($.id), $.id),
  },
  _tag_edit: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        xfn($.r)(
          s._tags($.tags, $.id),
          s.in($.tag, $.tags),
          s.html(
            $.r,
            "span",
            l(),
            x.view__file_link($.tag),
            x.view__button(
              l(s.class("DeleteExpr")),
              "⨉",
              s.on_click(s._delete_tag($.tag, $.id)),
            ),
          ),
        ),
        x._add_tag_menu($.id),
      ),
    ),
  },
  _add_tag_menu: {
    rule__params: l($.out, $.id),
    rule__body: s.view__menu(
      $.out,
      l(),
      "Add Tag",
      x.list(
        s.option("_new_tag_for", "New tag…"),
        xfn($.opt)(
          s.db__schema("tag", $.tag),
          s._name($.name, $.tag),
          u($.opt, s.option($.tag, $.name)),
        ),
      ),
      s.on_change(
        s.match_cond(
          l("_new_tag_for", s._new_tag_for($.id)),
          l($.tag, s._add_tag($.tag, $.id)),
        ),
      ),
    ),
  },
  _new_tag_for: {
    rule__params: l($.id),
    rule__body: seq(
      s.id($.tag),
      s.db__update(
        l(s.update(s.db__schema("tag", $.tag)), s.update(s._name("", $.tag))),
      ),
      s._add_tag($.tag, $.id),
      s.current_window($.window),
      s.on__push($.window, s.location($.tag, "_view")),
    ),
  },
  _add_tag: {
    rule__params: l($.tag, $.id),
    rule__body: seq(
      s.value_record_field_default($.tags, $.id, "_tags", l()),
      s.none(s.in($.tag, $.tags)),
      s.append($.next, $.tags, l($.tag)),
      s.db__update(l(s.update(s._tags($.next, $.id)))),
    ),
  },
  _delete_tag: {
    rule__params: l($.tag, $.id),
    rule__body: seq(
      s._tags($.tags, $.id),
      s.filter_list($.next, $.tags, s.not_equal($.tag)),
      s.db__update(l(s.update(s._tags($.next, $.id)))),
    ),
  },

  _view: {
    db__schema: "view",
    file__name: "File",
    view__subject: s.any(),
    view__focus_type: s.enum(s.none(), s._name(s.number(), s.number())),
    view__menu_items: l(
      s.menu(
        "Edit",
        l(
          s.menu_option(
            "copy",
            "Copy",
            fn(
              $.id,
              $.state,
            )(
              s.match_cond(
                x.get_focus($.state, s.none()),
                l(s.none(), s.ok()),
                l(
                  s._name($.from, $.to),
                  s.clipboard__copy_selected_string(
                    x._name($.id),
                    $.from,
                    $.to,
                  ),
                ),
              ),
            ),
          ),
          // s.menu_option("cut", "Cut", s._with_selection(s._on_cut())),
          // s.menu_option("copy", "Copy", s._with_selection(s._on_copy())),
          // s.menu_option("paste", "Paste", s._with_selection(s._on_paste())),
          // s.menu_option("clear", "Clear", s._with_selection(s._on_clear())),
          s.menu_option(
            "clipboard",
            "Show Clipboard",
            fn(__, __)(s.show_clipboard()),
          ),
        ),
      ),
    ),
    rule__params: l($.out, $.id, $.state),
    rule__body: s.table(
      $.out,
      l(),
      x.table_section(
        x.table_header(l(), "Name"),
        x.table_row(
          l(),
          x.view__input(
            l(),
            x.value_record_field_default($.id, "_name", ""),
            s.match_cond(
              l(
                s.change($.value),
                s.db__update(l(s.update(s._name($.value, $.id)))),
              ),
              l(
                s.select($.from, $.to),
                s.set_focus($.state, s._name($.from, $.to)),
              ),
              l(__, s.ok()),
            ),
          ),
        ),
      ),
      x.table_section(
        x.table_header(l(), "Description"),
        x.table_row(
          l(),
          x.view__text(
            x.value_record_field_default($.id, "_description", l("")),
          ),
        ),
      ),
      x.table_section(
        x.table_header(l(), "Tags"),
        x.table_row(l(), x._tag_edit($.id)),
      ),
      x.table_section(
        x.table_header(l(), "Preview"),
        xfn($.out)(
          s.schema__preview_for($.preview, $.id),
          s.table_row($.out, l(), $.preview),
        ),
      ),
      x.table_section(
        x.table_header(l(), "Actions"),
        x.table_row(
          l(),
          x.view__button(
            l(),
            "Delete Record",
            s.on_click(
              seq(
                s.current_window($.window),
                s.db__update(l(s.delete($.id))),
                s.on__close_window($.window),
              ),
            ),
          ),
        ),
      ),
    ),
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
        x.row(
          l(),
          xfn($.u)(
            s.db__schema($.schema, $.id),
            alt(
              s.view__file_link($.u, $.schema),
              u($.u, ":"),
              s.view__spacer($.u, "0.5rem"),
            ),
          ),
          x.view__file_link($.id),
        ),
        xfn($.out)(
          s.file__description($.desc, $.id),
          s.view__text($.out, $.desc),
        ),
      ),
    ),
  },
});

export const { rules: collectionInitState } = pkg("file", {
  // items
  example_tag: {
    db__schema: "tag",
    _name: "Example Tag",
    _description: l("A tag with some items"),
  },
});
