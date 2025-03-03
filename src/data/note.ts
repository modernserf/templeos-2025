import { Rec } from ".";
import { l, s, $, seq, u, __, f } from "../expr";
import { pkg } from "../pkg";

export const note = pkg("note", {
  // public
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

  // private
  _view_detail: {
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
          s._on_update($.id, $.next),
        ),
      ),
    ),
  },
  _view: {
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
                  s._on_update($.id, ""),
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
                  s._on_update($.id, $.content),
                ),
              ),
              l("clear", seq(s._on_update($.id, ""))),
            ),
          ),
        ),
        s._view_detail($.id),
      ),
    ),
  },
  _view_list: {
    rule__params: l($.out),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.view__button(
          l(),
          "New note",
          seq(s.receive(s.click(__)), s._on_new()),
        ),
        s.expr_iter(f.db__schema($.id, "note"), s._view_detail($.id)),
      ),
    ),
  },
  _view_all: {
    db__schema: "form",
    file__name: "Notes",
    rule__params: l($.out, __, __),
    rule__body: s.view__subscribe_render(
      $.out,
      s.record("note"),
      s._view_list(),
    ),
  },

  _new: {
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
  _on_update: {
    rule__params: l($.id, $.value),
    rule__body: seq(s.db__update(l(s.update($.id, "note__content", $.value)))),
  },
  _on_new: {
    rule__params: l(),
    rule__body: seq(s._new($.batch, __, __), s.db__update($.batch)),
  },
});

export const noteInitState = {
  example_note: {
    db__schema: "note",
    file__name: "Example note",
    note__content: "This is an example note",
    time__created: 1740219570821,
  },
} satisfies Record<string, Rec>;
