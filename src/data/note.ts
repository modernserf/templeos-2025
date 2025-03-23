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
    rule__params: l($.out, $.id, $.on_change),
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
        $.on_change,
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
          s.menu_option("cut", "Cut", s._with_id(s._on_cut())),
          s.menu_option("copy", "Copy", s._with_id(s._on_copy())),
          s.menu_option("paste", "Paste", s._with_id(s._on_paste())),
          s.menu_option("clear", "Clear", s._with_id(s._on_clear())),
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
    rule__body: s._view_detail(
      $.out,
      $.id,
      s.match_cond(
        l(s.change($.value), s._on_update($.value, $.id)),
        l(__, s.ok()),
      ),
    ),
  },
  _view_list: {
    rule__params: l($.out, $.state),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        x.view__button(l(), "New note", s.on_click(s._on_new())),
        xfn($.out)(
          s.db__schema("note", $.id),
          s._view_detail(
            $.out,
            $.id,
            s.match_cond(
              l(s.change($.value), s._on_update($.value, $.id)),
              l(s.focus(), s.set_focus($.state, s.id($.id))),
              l(__, s.ok()),
            ),
          ),
        ),
      ),
    ),
  },
  _view_all: {
    db__schema: "view",
    view__subject: s.self(),
    view__focus_type: s.enum(s.none(), s.id(s.ref("note"))),
    view__menu_items: l(
      s.menu(
        "Edit",
        l(
          s.menu_option("cut", "Cut", s._with_focus(s._on_cut())),
          s.menu_option("copy", "Copy", s._with_focus(s._on_copy())),
          s.menu_option("paste", "Paste", s._with_focus(s._on_paste())),
          s.menu_option("clear", "Clear", s._with_focus(s._on_clear())),
          s.menu_option(
            "clipboard",
            "Show Clipboard",
            fn(__, __)(s.show_clipboard()),
          ),
        ),
      ),
    ),
    file__name: "Notes",
    rule__params: l($.out, __, $.state),
    rule__body: s.view__subscribe_render(
      $.out,
      s.match_cond(
        l(s.update($.rec, __, __), s.db__schema("note", $.rec)),
        l(s.delete($.rec), s.db__schema("note", $.rec)),
        l(__, s.fail()),
      ),
      s._view_list($.state),
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
  _with_focus: {
    rule__params: l(__, $.state, $.fn),
    rule__body: seq(
      s.get_focus(s.id($.id), $.state, s.none()),
      s.call($.fn, $.id),
    ),
  },
  _with_id: {
    rule_params: l($.id, $.fn),
    rule__body: s.call($.fn, $.id),
  },
  _on_cut: {
    rule__params: l($.id),
    rule__body: seq(
      s._content($.content, $.id),
      s.clipboard__copy($.content),
      s._on_update("", $.id),
    ),
  },
  _on_copy: {
    rule__params: l($.id),
    rule__body: seq(s._content($.content, $.id), s.clipboard__copy($.content)),
  },
  _on_paste: {
    rule__params: l($.id),
    rule__body: seq(
      s.clipboard__paste($.content),
      s.string($.content),
      s._on_update($.content, $.id),
    ),
  },
  _on_clear: {
    rule__params: l($.id),
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
