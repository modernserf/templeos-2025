import { Rec } from ".";
import { l, s, $, seq, u, __, f, alt } from "../expr";
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

  view__all_notes_component: {
    rule__params: l(),
    rule__body: alt(
      s.loop(
        seq(
          s.receive(s.mount($.vc_renderer)),
          s.self($.self),
          s.db__subscribe_callback(
            $.sub,
            s.record("note"),
            s.send($.self, s.render()),
          ),
          s.send($.self, s.render()),
          s.loop(
            seq(
              s.receive($.e),
              s.match_cond(
                $.e,
                l(
                  s.render(),
                  seq(
                    s.column(
                      $.out,
                      l(),
                      s.expr_iter(
                        f.db__schema($.id, "note"),
                        s.view__note_detail($.id),
                      ),
                    ),
                    s.send($.vc_renderer, $.out),
                  ),
                ),
                l(s.unmount(), seq(s.db__unsubscribe($.sub), s.fail())),
              ),
            ),
          ),
        ),
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
          seq(s.receive(s.click(__)), s.on__new_note($.window)),
        ),
        s("=", s.Receiver(s.view__all_notes_component(), "view__all_notes")),
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
    rule__body: seq(
      // FIXME
      f.browser__current_window("browser", $.window),
      s.db__update(l(s.update($.id, "note__content", $.value))),
    ),
  },

  on__new_note: {
    rule__params: l($.window),
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
