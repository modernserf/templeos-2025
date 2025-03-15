import { Rec } from ".";
import { $, __, f, l, s, seq } from "../expr";
import { pkg } from "../pkg";

export const clipboardRules = pkg("clipboard", {
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
    field__type: s.list(s.type__any()),
  },
  // views
  view__clipboard: {
    view__subject: s.schema("clipboard"),
    view__name: "Clipboard",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.wrap(
        $.out,
        l(),
        s.expr_iter_else(
          seq(f._data($.id, $.data), s($.value).in($.data)),
          l(s.view__expr($.value)),
          l(s.view__string("clipboard is empty")),
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

  // private
  _handle_copy: {
    rule__params: l($.id, $.value),
    rule__body: seq(
      f._data($.id, $.prev),
      s.append_left_right($.next, $.prev, l($.value)),
      s.db__update(l(s.update($.id, "_data", $.next))),
    ),
  },
  _handle_paste: {
    rule__params: l($.id, $.value),
    rule__body: seq(
      f._data($.id, $.data),
      s.append_left_right($.data, __, l($.value)),
    ),
  },
  _handle_drop: {
    rule__params: l($.id),
    rule__body: seq(
      f._data($.id, $.prev),
      s.append_left_right($.prev, $.rest, l(__)),
      s.db__update(l(s.update($.id, "_data", $.rest))),
    ),
  },
});

export const clipboardInitState = {
  root_clipboard: {
    db__schema: "clipboard",
    file__name: "Clipboard",
    clipboard__data: l("init"),
  },
} satisfies Record<string, Rec>;
