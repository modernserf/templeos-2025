import { l, s, $, seq, u, __, x, xfn, fn } from "../expr";
import { pkg } from "../pkg";

export const { rules: note } = pkg("note", {
  // public
  note: {
    db__schema: "schema",
    file__name: "Note",
    file__description: l("A plain text note"),
    schema__fields: l(s.field("_content")),
  },

  // private
  _content: {
    db__schema: "field",
    file__name: "Note content",
    field__type: s.string(),
  },

  _view_detail: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s._content($.content, $.id),
      s.view__textarea(
        $.out,
        l(
          s.style("width", "100%"),
          s.style("minHeight", "8rem"),
          s.debounce(500),
        ),
        $.content,
        s.on_change(s._on_update($.id)),
      ),
    ),
  },
  _view: {
    db__schema: "view",
    view__subject: s.schema("note"),
    view__menu_items: l(
      s.menu(
        "Edit",
        l(
          s.menu_option("cut", "Cut", s._on_cut_1()),
          s.menu_option("copy", "Copy", s._on_copy_1()),
          s.menu_option("paste", "Paste", s._on_paste_1()),
          s.menu_option("clear", "Clear", s._on_clear_1()),
          s.menu_option(
            "clipboard",
            "Show Clipboard",
            fn(__, __)(s.show_clipboard()),
          ),
        ),
      ),
    ),
    file__name: "Note",
    rule__params: l($.out, $.id, $._state),
    rule__body: s._view_detail($.out, $.id),
  },
  _view_list: {
    rule__params: l($.out),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        x.view__button(l(), "New note", s.on_click(s._on_new())),
        xfn($.out)(s.db__schema("note", $.id), s._view_detail($.out, $.id)),
      ),
    ),
  },
  _view_all: {
    db__schema: "view",
    view__subject: s.self(),
    file__name: "Notes",
    rule__params: l($.out, __, __),
    rule__body: s.view__subscribe_render(
      $.out,
      s.match_cond(
        l(s.update($.rec, __, __), s.db__schema("note", $.rec)),
        l(s.delete($.rec), s.db__schema("note", $.rec)),
        l(__, s.fail()),
      ),
      s._view_list(),
    ),
  },

  _new: {
    rule__params: l($.out, $.id, $.content),
    rule__body: seq(
      s.or_default($.id, x.id()),
      s.or_default($.content, ""),
      u(
        $.out,
        l(
          s.update(s.db__schema("note", $.id)),
          s.update(s._content($.content, $.id)),
        ),
      ),
    ),
  },
  _on_update: {
    rule__params: l($.value, $.id),
    rule__body: s.db__update(l(s.update(s._content($.value, $.id)))),
  },
  _on_new: {
    rule__params: l(),
    rule__body: seq(s._new($.batch, __, __), s.db__update($.batch)),
  },
  // TODO: selection
  _on_cut_1: {
    rule__params: l($.id, $._state),
    rule__body: seq(
      s._content($.content, $.id),
      s.clipboard__copy($.content),
      s._on_update("", $.id),
    ),
  },
  _on_copy_1: {
    rule__params: l($.id, $._state),
    rule__body: seq(s._content($.content, $.id), s.clipboard__copy($.content)),
  },
  _on_paste_1: {
    rule__params: l($.id, $._state),
    rule__body: seq(
      s.clipboard__paste($.content),
      s.string($.content),
      s._on_update($.content, $.id),
    ),
  },
  _on_clear_1: {
    rule__params: l($.id, $._state),
    rule__body: seq(s._on_update("", $.id)),
  },
});

export const { rules: noteInitState } = pkg("note", {
  example_note: {
    db__schema: "note",
    file__name: "Example note",
    _content: "This is an example note",
    time__created: 1740219570821,
  },
});
