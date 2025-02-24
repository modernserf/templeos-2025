import { Rec } from ".";
import { l, s, $, seq, u, __, f } from "../expr";

export const note = {
  note: {
    db__schema: "schema",
    file__name: "Note",
    file__description: l("A plain text note"),
    db__fields: l(s.field("note__content")),
  },
  note__content: {
    db__schema: "field",
    file__name: "Note content",
    db__type: "string",
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
          s.on__note_update($.id, $.next),
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
                  s.clipboard__copy($.content),
                  s.on__note_update($.id, ""),
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
                  s.on__note_update($.id, $.content),
                ),
              ),
              l("clear", seq(s.on__note_update($.id, ""))),
            ),
          ),
        ),
        s.view__note_detail($.id),
      ),
    ),
  },
  view__all_notes: {
    db__schema: "form",
    file__name: "Notes",
    rule__params: l($.out, __, __),
    rule__body: s.view__subscribe_render(
      $.out,
      s.record("note"),
      s.view__all_notes__(),
    ),
  },
  view__all_notes__: {
    rule__params: l($.out),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.view__button(
          l(),
          "New note",
          seq(s.receive(s.click(__)), s.on__new_note()),
        ),
        s.expr_iter(f.db__schema($.id, "note"), s.view__note_detail($.id)),
      ),
    ),
  },

  new__note: {
    rule__params: l($.out, $.id, $.content),
    rule__body: seq(
      s.if_var($.id, s.id($.id)),
      s.if_var($.content, u($.content, "")),
      u(
        $.out,
        l(
          s.update($.id, "db__schema", "note"),
          s.update($.id, "note__content", $.content),
        ),
      ),
    ),
  },

  on__note_update: {
    rule__params: l($.id, $.value),
    rule__body: seq(s.db__update(l(s.update($.id, "note__content", $.value)))),
  },

  on__new_note: {
    rule__params: l(),
    rule__body: seq(s.new__note($.batch, __, __), s.db__update($.batch)),
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
