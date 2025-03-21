import { l, seq, s, $, __, u, fn, x, xfn, alt } from "../expr";
import { pkg } from "../pkg";

export const { rules: viewAnyRecord } = pkg("any_record", {
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
        l(s.expand(), s._view_expand($.out, $.value)),
      ),
    ),
  },
  _view_expand: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.unpack_expand($.content, $.value),
      s.html(
        $.out,
        "span",
        l(s.class("_view_expand")),
        // x.view__string("{"),
        x.view__expr($.content),
        // x.view__string("}"),
      ),
    ),
  },

  _view_var: {
    rule__params: l($.out, $.var),
    rule__body: seq(
      s.cond(s.ident_var($.ident, $.var), u($.ident, "__")),
      s.html($.out, "span", l(s.class("_view_var")), x.view__string($.ident)),
    ),
  },
  _view_number: {
    rule__params: l($.out, $.value),
    rule__body: s.html(
      $.out,
      "span",
      l(s.class("_view_number")),
      x.view__string(x.string_number($.value)),
    ),
  },
  _view_string: {
    rule__params: l($.out, $.value),
    rule__body: s.html(
      $.out,
      "span",
      l(s.class("_view_string")),
      x.view__string('"'),
      x.view__string($.value),
      x.view__string('"'),
    ),
  },
  _view_box: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.box($.value, $.tag, $.list),
      s.html(
        $.out,
        "span",
        l(s.class("_view_box")),
        x.html("span", l(), x.view__file_link($.tag)),
        x.html("span", l(), x.view__string("(")),
        xfn($.out)(
          s.index_value_box($.i, $.arg, $.list),
          alt(
            s.if_then_else(
              u($.i, 0),
              s.fail(),
              s.html($.out, "span", l(), x.view__string(", ")),
            ),
            s.view__expr($.out, $.arg),
          ),
        ),
        x.html("span", l(), x.view__string(")")),
      ),
    ),
  },
  _view_field: {
    rule__params: l($.out, $.field, $.id),
    rule__body: seq(
      s.value_record_field($.value, $.id, $.field),
      s.html($.out, "div", l(), x.view__expr($.value)),
    ),
  },
  _clickable: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props, $.handler), $.children),
      u($.out, s.Clickable($.props, $.handler, $.children)),
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
    db__schema: "view",
    file__name: "Default viewer",
    view__focus_type: s.enum(
      s.none(),
      s.id_key(),
      s.id_value(),
      s.field_key(s.ref("field")), // TODO: are undeclared fields "wrong" to type system?
      s.field_value(s.any_type()),
      s.ref_key(s.ref(__)),
      s.ref_value(s.ref(__)),
    ),
    view__subject: s.any(),
    view__menu_items: l(
      s.menu(
        "Edit",
        l(
          s.menu_option("copy", "Copy", s._copy_selected()),
          s.menu_option(
            "clipboard",
            "Show Clipboard",
            fn(__, __)(
              s.current_clipboard($.clipboard),
              s.on__new_window(s.location($.clipboard)),
            ),
          ),
        ),
      ),
    ),
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        x.table(
          l(),
          x.table_section(
            x.table_header(
              l(),
              x.view__string("Field"),
              x.view__string("Value"),
            ),
            x.table_row(
              l(),
              x._focus_cell($.state, s.id_key(), x.view__string("id")),
              x._focus_cell($.state, s.id_value(), x.view__string($.id)),
            ),
            xfn($.out)(
              s.field_record($.field, $.id),
              s.table_row(
                $.out,
                l(),
                x._focus_cell(
                  $.state,
                  s.field_key($.field),
                  x.view__file_link($.field),
                ),
                x._focus_cell(
                  $.state,
                  s.field_value($.field),
                  x._view_field($.field, $.id),
                ),
              ),
            ),
          ),
          x.table_section(
            x.table_header(
              l(),
              s.view__string("Reference"),
              s.view__string("Record"),
            ),
            xfn($.out)(
              s.ref_field_record($.ref, $.field, $.id),
              s.table_row(
                $.out,
                l(),
                x._focus_cell(
                  $.state,
                  s.ref_key($.field),
                  x.view__file_link($.field),
                ),
                x._focus_cell(
                  $.state,
                  s.ref_key($.field),
                  x.view__file_link($.ref),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
});
