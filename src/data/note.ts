import { Rec } from ".";
import { l, s, $, seq, u, __, alt, f } from "../expr";
import { db } from "./db";

export const note = {
  note: {
    db__schema: "schema",
    file__name: "Note",
    file__description: l("A plain text note"),
    db__fields: l(db.field("note__content")),
  },
  note__content: {
    db__schema: "field",
    file__name: "Note content",
    db__type: "string",
  },

  new__note: {
    rule__params: l($.id, $.content),
    rule__body: db.with_tx(
      $.tx,
      s.if_var($.id, s.id($.id)),
      s.if_var($.content, u($.content, "")),
      db.update($.tx, $.id, "db__schema", "note"),
      db.update($.tx, $.id, "note__content", $.content),
      s.send("local_storage", s.update()),
    ),
  },

  note__update: {
    rule__params: l($.id, $.value),
    rule__body: db.with_tx(
      $.tx,
      db.update($.tx, $.id, "note__content", $.value),
      s.send("local_storage", s.update()),
    ),
  },

  view__note_detail: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      f.note__content($.id, $.content),
      s.view__textarea(
        $.out,
        l(
          s.style("width", "100%"),
          s.style("minHeight", "8rem"),
          s.debounce(500),
        ),
        $.content,
        seq(
          s.receive($.e),
          u($.e, s.change($.next)),
          s.note__update($.id, $.next),
        ),
      ),
    ),
  },

  view__note: {
    view__schema: "note",
    file__name: "Note",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.view__menu(
          l(),
          "Edit",
          l(
            s.option("cut", "Cut"),
            s.option("copy", "Copy"),
            s.option("paste", "Paste"),
            s.option("clear", "Clear"),
          ),
          seq(
            s.receive($.e),
            u($.e, s.change($.command)),
            f.history__window($.state, $.window),
            s.match_cond(
              $.command,
              l(
                "cut",
                seq(
                  f.note__content($.id, $.content),
                  s.note__update($.id, ""),
                  s.clipboard__copy($.content),
                ),
              ),
              l(
                "copy",
                seq(
                  f.note__content($.id, $.content),
                  s.clipboard__copy($.content),
                ),
              ),
              l(
                "paste",
                seq(
                  s.clipboard__paste($.content),
                  s.note__update($.id, $.content),
                ),
              ),
              l("clear", seq(s.note__update($.id, ""))),
            ),
            s.dispatch(s.render_window($.window)),
          ),
        ),
        s.view__note_detail($.id),
      ),
    ),
  },
  view__all_notes: {
    db__schema: "form",
    file__name: "Notes",
    rule__params: l($.out, __, $.state),
    rule__body: seq(
      f.history__window($.state, $.window),
      s.column(
        $.out,
        l(),
        s.view__button(
          l(),
          "New note",
          seq(
            s.receive(s.click(__)),
            s.new__note(__, __),
            s.dispatch(s.render_window($.window)),
          ),
        ),
        s.expr_iter(f.db__schema($.id, "note"), s.view__note_detail($.id)),
      ),
    ),
  },
} satisfies Record<string, Rec>;

export const noteInitState = {
  example_note: {
    db__schema: "note",
    file__name: "Example note",
    note__content: "This is an example note",
    time__created: 1740219570821,
  },
} satisfies Record<string, Rec>;
