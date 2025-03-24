import { $, __, l, s, seq, u, x, xfn } from "../expr";
import { pkg } from "../pkg";

export const { rules: clipboardRules } = pkg("clipboard", {
  // schema
  clipboard: {
    db__schema: "schema",
    file__name: "Clipboard",
    file__description: l("stores clipboard data"),
    schema__fields: l(s.field("_data")),
  },
  _data: {
    db__schema: "field",
    file__name: "Clipboard data",
    field__type: s.list_of(s.any_type()),
  },
  // views
  view__clipboard: {
    db__schema: "view",
    view__subject: s.schema("clipboard"),
    file__name: "Clipboard",
    rule__params: l($.out, $.id, $._state),
    rule__body: s.wrap(
      $.out,
      l(),
      xfn($.out)(
        s.if_then_else(
          seq(s._data($.data, $.id), s($.value).in($.data)),
          s.view__expr($.out, $.value),
          u($.out, "clipboard is empty"),
        ),
      ),
    ),
  },
  // public api
  clipboard__copy: {
    rule__params: l($.value),
    rule__body: seq(s.current_clipboard($.id), s._handle_copy($.id, $.value)),
  },
  clipboard__paste: {
    rule__params: l($.value),
    rule__body: seq(s.current_clipboard($.id), s._handle_paste($.id, $.value)),
  },
  // TODO: current clipboard ref is stored in browser
  current_clipboard: {
    rule__params: l("root_clipboard"),
  },
  show_clipboard: {
    rule__params: l(),
    rule__body: seq(
      s.current_clipboard($.clipboard),
      s.on__new_window(s.location($.clipboard)),
    ),
  },
  _cut_selected_string: {
    rule__params: l($.out, $.in, $.from, $.to),
    rule__body: seq(
      s.string_slice($.selection, $.in, $.from, $.to),
      s.string__concat(
        $.out,
        x.string_slice($.in, 0, $.from),
        x.string_slice($.in, $.to, x.string_length($.in)),
      ),
      s._copy($.selection),
    ),
  },
  _copy_selected_string: {
    rule__params: l($.in, $.from, $.to),
    rule__body: seq(
      s.string_slice($.selection, $.in, $.from, $.to),
      s._copy($.selection),
    ),
  },
  _paste_into_selected_string: {
    rule__params: l($.out, $.in, $.from, $.to),
    rule__body: seq(
      s.clipboard__paste($.paste),
      s.string($.paste),
      s.string__concat(
        $.out,
        x.string_slice($.in, 0, $.from),
        x.string__concat(
          $.paste,
          x.string_slice($.in, $.to, x.string_length($.in)),
        ),
      ),
    ),
  },

  // private
  _handle_copy: {
    rule__params: l($.id, $.value),
    rule__body: seq(
      s._data($.prev, $.id),
      s.append($.next, $.prev, l($.value)),
      s.db__update(l(s.update($.id, "_data", $.next))),
    ),
  },
  _handle_paste: {
    rule__params: l($.id, $.value),
    rule__body: seq(s._data($.data, $.id), s.append($.data, __, l($.value))),
  },
  _handle_drop: {
    rule__params: l($.id),
    rule__body: seq(
      s._data($.prev, $.id),
      s.append($.prev, $.rest, l(__)),
      s.db__update(l(s.update($.id, "_data", $.rest))),
    ),
  },
});

export const { rules: clipboardInitState } = pkg("clipboard", {
  root_clipboard: {
    db__schema: "clipboard",
    file__name: "Clipboard",
    clipboard__data: l("init"),
  },
});
