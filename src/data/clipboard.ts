import { Rec } from ".";
import { $, __, f, l, s, seq } from "../expr";
import { db } from "./db";

export const clipboardRules = {
  // schema
  clipboard: {
    db__schema: "schema",
    file__name: "Clipboard",
    file__description: l("stores clipboard data"),
    db__fields: l(db.field("clipboard__data")),
  },
  clipboard__data: {
    db__schema: "field",
    file__name: "Clipboard data",
  },
  // views
  view__clipboard: {
    view__schema: "clipboard",
    view__name: "Clipboard",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.wrap(
        $.out,
        l(),
        s.expr_iter_else(
          seq(
            f.clipboard__data($.id, $.data),
            s.value_box_index($.value, $.data, __),
          ),
          l(s.view__expr($.value)),
          l(s.view__string("clipboard is empty")),
        ),
      ),
    ),
  },
  // public api
  clipboard__copy: {
    rule__params: l($.value),
    rule__body: s.send("clipboard_server", s.copy($.value)),
  },
  clipboard__paste: {
    rule__params: l($.value),
    rule__body: seq(
      s.self($.pid),
      s.send("clipboard_server", s.paste($.pid)),
      s.receive(s.paste($.value)),
    ),
  },

  // TODO: "init" schema that runs on startup
  init_clipboard: {
    rule__params: l(),
    rule__body: seq(s.spawn(s.clipboard_server(), "clipboard_server")),
  },

  // TODO: current clipboard ref is stored in browser
  current_clipboard: {
    rule__params: l("root_clipboard"),
  },

  clipboard_server: {
    rule__params: l(),
    rule__body: s.loop(
      seq(
        s.receive($.msg),
        s.current_clipboard($.id),
        s.match_cond(
          $.msg,
          l(s.copy($.value), s.clipboard__handle_copy($.id, $.value)),
          l(
            s.paste($.pid),
            seq(
              s.clipboard__handle_paste($.id, $.value),
              s.send($.pid, s.paste($.value)),
            ),
          ),
          l(s.drop(), s.clipboard__handle_drop($.id)),
        ),
      ),
    ),
  },

  clipboard__handle_copy: {
    rule__params: l($.id, $.value),
    rule__body: seq(
      f.clipboard__data($.id, $.prev),
      s.append_left_right($.next, $.prev, l($.value)),
      s.db__update(l(s.update($.id, "clipboard__data", $.next))),
    ),
  },
  clipboard__handle_paste: {
    rule__params: l($.id, $.value),
    rule__body: seq(
      f.clipboard__data($.id, $.data),
      s.append_left_right($.data, __, l($.value)),
    ),
  },
  clipboard__handle_drop: {
    rule__params: l($.id),
    rule__body: seq(
      f.clipboard__data($.id, $.prev),
      s.append_left_right($.prev, $.rest, l(__)),
      s.db__update(l(s.update($.id, "clipboard__data", $.rest))),
    ),
  },
} satisfies Record<string, Rec>;

export const clipboardInitState = {
  root_clipboard: {
    db__schema: "clipboard",
    file__name: "Clipboard",
    clipboard__data: l("init"),
  },
} satisfies Record<string, Rec>;
