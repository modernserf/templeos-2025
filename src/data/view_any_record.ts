import { l, seq, s, $, __, u, fn } from "../expr";
import { pkg } from "../pkg";

export const viewAnyRecord = pkg("any_record", {
  // public
  view__expr: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.type_value($.type, $.value),
      s.match_cond(
        $.type,
        l(s.var(), s._view_var($.out, $.value)),
        l(s.number(), s._view_number($.out, $.value)),
        l(s.string(), s._view_string($.out, $.value)),
        l(s.box(), s._view_box($.out, $.value)),
      ),
    ),
  },

  _view_var: {
    rule__params: l($.out, $.var),
    rule__body: seq(
      s.ident_var($.ident, $.var),
      s.view__string($.out, $.ident),
    ),
  },
  _view_number: {
    rule__params: l($.out, $.value),
    rule__body: seq(s.view__string($.out, $.value)),
  },
  _view_string: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.html(
        $.out,
        "span",
        l(),
        s.view__string('"'),
        s.view__string($.value),
        s.view__string('"'),
      ),
    ),
  },
  _view_box: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.box_tag_list($.value, $.tag, $.list),
      s.wrap(
        $.out,
        l(),
        s.html("span", l(), s.view__file_link($.tag), s.view__string("(")),
        s.view__spacer("0.25rem"),
        s.expr_iter(
          s($.arg).in($.list),
          s.html("span", l(s.style("flex", "1 1 auto")), s.view__expr($.arg)),
          s.view__spacer("0.25rem"),
        ),
        s.html("span", l(), s.view__string(")")),
      ),
    ),
  },
  _view_field: {
    rule__params: l($.out, $.field, $.id),
    rule__body: seq(
      s.value_record_field($.value, $.id, $.field),
      s.html($.out, "div", l(), s.view__expr($.value)),
    ),
  },
  _clickable: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props, $.handler), $.children),
      s.expr_children($.rendered_children, $.children),
      u($.out, s.Clickable($.props, $.handler, $.rendered_children)),
    ),
  },
  _focus_cell: {
    rule__params: l($.out, $.state, $.path, $.item),
    rule__body: seq(
      s.get_focus($.focus, $.state, s.none()),
      s.match(
        l($.focus, $.props),
        l($.path, l(s.style("outline", "2px solid black"))),
        l(__, l()),
      ),
      s._clickable(
        $.out,
        $.props,
        fn(s.click(__))(
          s.if_then_else(
            u($.focus, $.path),
            s.set_focus($.state, s.none()),
            s.set_focus($.state, $.path),
          ),
        ),
        $.item,
      ),
    ),
  },
  _copy_selected: {
    rule__params: l($.id, $.state),
    rule__body: seq(
      s.get_focus($.focus, $.state, s.none()),
      s.match_cond(
        $.focus,
        l(s.id_key(), s.clipboard__copy("id")),
        l(s.id_value(), s.clipboard__copy($.id)),
        l(s.field_key($.field), s.clipboard__copy($.field)),
        l(
          s.field_value($.field),
          seq(
            s.value_record_field($.value, $.id, $.field),
            s.clipboard__copy($.value),
          ),
        ),
        l(s.ref_key($.field), s.clipboard__copy($.field)),
        l(
          s.ref_value($.field),
          seq(
            s.ref_field_record($.ref, $.field, $.id),
            s.clipboard__copy($.ref),
          ),
        ),
      ),
    ),
  },
  _view: {
    file__name: "Default viewer",
    view__schema: "any_record",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.get_focus($.focus, $.state, s.none()),
      // FIXME: put in menu bar
      s.column(
        $.out,
        l(),
        s.row(
          l(),
          s.view__menu(
            l(),
            "Edit",
            l(s.option("copy", "Copy")),
            s.on_change(
              s.match_cond(l("copy", s._copy_selected($.id, $.state))),
            ),
          ),
        ),
        s.table(
          l(),
          s.table_section(
            l(),
            l(s.view__string("Field"), s.view__string("Value")),
            s.table_row(
              l(),
              s._focus_cell($.state, s.id_key(), s.view__string("id")),
              s._focus_cell($.state, s.id_value(), s.view__string($.id)),
            ),
            s.expr_iter(
              s.field_record($.field, $.id),
              s.table_row(
                l(),
                s._focus_cell(
                  $.state,
                  s.field_key($.field),
                  s.view__file_link($.field),
                ),
                s._focus_cell(
                  $.state,
                  s.field_value($.field),
                  s._view_field($.field, $.id),
                ),
              ),
            ),
          ),
          s.table_section(
            l(),
            l(s.view__string("Reference"), s.view__string("Record")),
            s.expr_iter(
              s.ref_field_record($.ref, $.field, $.id),
              s.table_row(
                l(),
                s._focus_cell(
                  $.state,
                  s.ref_key($.field),
                  s.view__file_link($.field),
                ),
                s._focus_cell(
                  $.state,
                  s.ref_key($.field),
                  s.view__file_link($.ref),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
});
