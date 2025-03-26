import { l, s, $, seq, u, __, x, fn, alt } from "../expr";
import { pkg } from "../pkg";

export const { rules: note } = pkg("note", {
  // public
  note: {
    db__schema: "schema",
    file__name: "Note",
    file__description: l("A plain text note"),
    schema__fields: l(
      s.field("_content"),
      s.field("file__name"),
      s.field("time__created"),
      s.field("time__updated"),
    ),
    schema__preview: s._content(),
  },
  // private
  _content: {
    db__schema: "field",
    file__name: "Note content",
    field__type: s.string(),
  },
  _view: {
    db__schema: "view",
    view__subject: s.schema("note"),
    view__focus_type: s.enum(
      s.none(),
      s.id_select(s.t_ref("note"), s.number(), s.number()),
    ),
    view__menu_items: l(
      s.menu(
        "Edit",
        l(
          s.menu_option("cut", "Cut", s._with_selection(s._on_cut())),
          s.menu_option("copy", "Copy", s._with_selection(s._on_copy())),
          s.menu_option("paste", "Paste", s._with_selection(s._on_paste())),
          s.menu_option("clear", "Clear", s._with_selection(s._on_clear())),
          s.menu_option(
            "clipboard",
            "Show Clipboard",
            fn(__, __)(s.show_clipboard()),
          ),
        ),
      ),
    ),
    file__name: "Note",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.file__name($.name, $.id),
      s._content($.content, $.id),
      s.column(
        $.out,
        l(),
        x.view__input(
          l(s.style("width", "100%"), s.debounce(500)),
          $.name,
          s.match_cond(
            l(s.change($.value), s._on_update(s.file__name($.value, $.id))),
            // TODO select
            l(__, s.ok()),
          ),
        ),
        x.view__textarea(
          l(
            s.style("width", "100%"),
            s.style("minHeight", "8rem"),
            s.debounce(500),
          ),
          $.content,
          s.match_cond(
            l(s.change($.value), s._on_update(s._content($.value, $.id))),
            l(
              s.select($.start, $.end),
              s.set_focus($.state, s.id_select($.id, $.start, $.end)),
            ),
            l(__, s.ok()),
          ),
        ),
      ),
    ),
  },
  _notes_by_time_created: {
    rule__params: l($.id, $.sort_by),
    rule__body: seq(
      s.collect_item_in(
        $.notes,
        l($.ts, $.note_id),
        seq(s.db__schema("note", $.note_id), s.time__created($.ts, $.note_id)),
      ),
      s.sort($.sorted, $.notes, $.sort_by),
      s.in(l(__, $.id), $.sorted),
    ),
  },
  __view_all: {
    rule__params: l($.out, $.state),
    rule__body: s.column(
      $.out,
      l(),
      x.view__button(l(), "New note", s.on_click(s._on_new())),
      x.search__view(
        $.state,
        l(),
        fn($.id, $.search)(
          s._notes_by_time_created($.id, s.ord_desc()),
          s.file__name($.name, $.id),
          s.string_substring($.name, $.search),
        ),
        fn(
          $.o,
          $.id,
        )(
          alt(
            s.view__file_link($.o, $.id),
            // TODO: note preview
            s.html($.o, "div", l(), x._content($.id)),
          ),
        ),
      ),
    ),
  },
  _view_all: {
    db__schema: "view",
    view__subject: s.self(),
    file__name: "Notes",
    rule__params: l($.out, __, $.state),
    rule__body: s.view__subscribe_render(
      $.out,
      s.match_cond(
        l(s.update($.rec, __, __), s.db__schema("note", $.rec)),
        l(s.delete($.rec), s.db__schema("note", $.rec)),
        l(__, s.fail()),
      ),
      s.__view_all($.state),
    ),
  },
  _new: {
    rule__params: l($.out, $.id, $.content),
    rule__body: seq(
      s.or_default($.id, x.id()),
      s.or_default($.content, ""),
      s.timestamp($.ts),
      u(
        $.out,
        l(
          s.update(s.db__schema("note", $.id)),
          s.update(s.file__name("New Note", $.id)),
          s.update(s._content($.content, $.id)),
          s.update(s.time__created($.ts, $.id)),
          s.update(s.time__updated($.ts, $.id)),
        ),
      ),
    ),
  },
  _on_update: {
    rule__params: l($.field_update),
    rule__body: seq(
      s.timestamp($.ts),
      s.box($.field_update, __, l(__, $.id)),
      s.db__update(
        s.update($.field_update),
        s.update(s.time__updated($.ts, $.id)),
      ),
    ),
  },
  _on_new: {
    rule__params: l(),
    rule__body: seq(
      s._new($.batch, $.id, __),
      s.apply($.batch, s.db__update()),
      s.current_window($.window),
      s.on__push($.window, s.location($.id, "_view")),
    ),
  },
  _with_selection: {
    rule__params: l(__, $.state, $.fn),
    rule__body: seq(
      s.get_focus(s.id_select($.id, $.from, $.to), $.state, s.none()),
      s.call($.fn, $.id, $.from, $.to),
    ),
  },
  _on_cut: {
    rule__params: l($.id, $.from, $.to),
    rule__body: seq(
      s.clipboard__cut_selected_string(
        $.updated,
        x._content($.id),
        $.from,
        $.to,
      ),
      s._on_update(s._content($.updated, $.id)),
    ),
  },
  _on_copy: {
    rule__params: l($.id, $.from, $.to),
    rule__body: seq(
      s.clipboard__copy_selected_string(x._content($.id), $.from, $.to),
    ),
  },
  _on_paste: {
    rule__params: l($.id, $.from, $.to),
    rule__body: seq(
      s.clipboard__paste_into_selected_string(
        $.updated,
        x._content($.id),
        $.from,
        $.to,
      ),
      s._on_update(s._content($.updated, $.id)),
    ),
  },
  _on_clear: {
    rule__params: l($.id, __, __),
    rule__body: seq(s._on_update(s._content("", $.id))),
  },
});

export const { rules: noteInitState } = pkg("note", {
  example_note: {
    db__schema: "note",
    file__name: "Example note",
    _content: "This is an example note",
    time__created: 1740219570821,
    time__updated: 1740219570821,
  },
});
