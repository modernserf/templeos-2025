import { Rec } from "./data";
import { $, __, l, r, s, u, view } from "./expr";
import { db } from "./rule_db";

export const clipboardRules = {
  clipboard: {
    db__schema: "schema__clipboard",
    file__name: "Clipboard",
    clipboard__data: l("init"),
  },

  view__schema__clipboard: {
    db__schema: "schema__view",
    view__schema: "schema__clipboard",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.wrap(
        l(),
        s.children(
          view.iter_else(
            r(
              s.clipboard__data("clipboard", $.data),
              s.box_at_value($.data, __, $.value),
            ),
            l(view.expr($.value)),
            l(view.string("clipboard is empty")),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__test_clipboard_insert: {
    rule__params: l($.i, $.on_change, $.out),
    rule__body: view.button(
      l(s.style("margin", "1rem")),
      "Paste",
      l(__, view.dispatch($.on_change, s.paste($.i))),
      $.out,
    ),
  },
  view__test_clipboard_item: {
    rule__params: l($.i, $.value, $.on_change, $.out),
    rule__body: view.render(
      view.column(
        l(s.style("padding", "1rem")),
        s.children(
          view.expr($.value),
          view.menu(
            "Edit",
            l(s.option("cut", "Cut"), s.option("copy", "Copy")),
            l(
              s.change($.opt),
              s.match_cond(
                $.opt,
                l("cut", view.dispatch($.on_change, s.cut($.i))),
                l("copy", view.dispatch($.on_change, s.copy($.i))),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__test_clipboard_handler: {
    rule__params: l($.message, $.id, $.items),
    rule__body: s.match_cond(
      $.message,
      l(
        s.cut($.i),
        r(
          s.box_at_removed_splice($.items, $.i, l($.removed), $.next),
          s.on__copy($.removed),
          db.with_tx($.tx, db.update($.tx, $.id, "data", $.next)),
        ),
      ),
      l(
        s.copy($.i),
        r(s.box_at_value($.items, $.i, $.value), s.on__copy($.value)),
      ),
      l(
        s.paste($.i),
        r(
          s.on__paste($.value),
          s.box_at_inserted_splice($.items, $.i, l($.value), $.next),
          db.with_tx($.tx, db.update($.tx, $.id, "data", $.next)),
        ),
      ),
    ),
  },
  view__test_clipboard: {
    file__name: "Clipboard test",
    db__schema: "schema__form",
    data: l("test string", 123, s.cons("foo", s.nil())),
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      db.get($.id, "data", $.items),
      s.box_length($.items, $.length),
      u(
        $.on_change,
        l($.message, s.view__test_clipboard_handler($.message, $.id, $.items)),
      ),

      view.render(
        view.wrap(
          l(),
          s.children(
            view.iter(
              r(s.box_at_value($.items, $.i, $.value)),
              l(
                view.test_clipboard_insert($.i, $.on_change),
                view.test_clipboard_item($.i, $.value, $.on_change),
              ),
            ),
            view.test_clipboard_insert($.length, $.on_change),
          ),
        ),
        $.out,
      ),
    ),
  },

  on__copy: {
    rule__params: l($.value),
    rule__body: db.with_tx(
      $.tx,
      r(
        s.clipboard__data("clipboard", $.prev),
        s.box_box_append($.prev, l($.value), $.next),
        db.update($.tx, "clipboard", "clipboard__data", $.next),
      ),
    ),
  },
  on__paste: {
    rule__params: l($.value),
    rule__body: r(
      s.clipboard__data("clipboard", $.data),
      s.box_box_append(__, l($.value), $.data),
    ),
  },
  on__clipboard_rotate: {
    rule__params: l(),
    rule__body: db.with_tx(
      $.tx,
      r(
        s.clipboard__data("clipboard", $.prev),
        s.box_box_append($.rest, l($.last), $.prev),
        s.box_box_append(l($.last), $.rest, $.next),
        db.update($.tx, "clipboard", "clipboard__data", $.next),
      ),
    ),
  },
  on__clipboard_rotate_back: {
    rule__params: l(),
    rule__body: db.with_tx(
      $.tx,
      r(
        s.clipboard__data("clipboard", $.prev),
        s.box_box_append(l($.first), $.rest, $.prev),
        s.box_box_append($.rest, l($.first), $.next),
        db.update($.tx, "clipboard", "clipboard__data", $.next),
      ),
    ),
  },
  on__clipboard_drop: {
    rule__params: l(),
    rule__body: db.with_tx(
      $.tx,
      r(
        s.clipboard__data("clipboard", $.prev),
        s.box_box_append($.rest, l($.last), $.prev),
        db.update($.tx, "clipboard", "clipboard__data", $.rest),
      ),
    ),
  },
} satisfies Record<string, Rec>;
