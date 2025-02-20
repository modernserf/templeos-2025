import { Rec } from ".";
import { l, seq, s, $, __ } from "../expr";

export const viewAnyRecord = {
  view__expr_var: {
    rule__params: l($.out, $.value),
    rule__body: seq(s.view__string($.out, $.value)),
  },
  view__expr_number: {
    rule__params: l($.out, $.value),
    rule__body: seq(s.view__string($.out, $.value)),
  },
  view__expr_string: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.expr(
        $.out,
        s.view__html(
          "span",
          l(),
          s.children(
            s.view__string('"'),
            s.view__string($.value),
            s.view__string('"'),
          ),
        ),
      ),
    ),
  },
  view__expr_box: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.box_tag_list($.value, $.tag, $.list),
      s.expr(
        $.out,
        s.view__wrap(
          l(),
          s.children(
            s.view__html(
              "span",
              l(),
              s.children(s.view__string($.tag), s.view__string("(")),
            ),
            s.expr_iter(
              s.value_box_index($.arg, $.list, __),
              s.view__html("span", l(), s.children(s.view__expr($.arg))),
            ),
            s.view__html("span", l(), s.children(s.view__string(")"))),
          ),
        ),
      ),
    ),
  },

  view__expr: {
    rule__params: l($.out, $.value),
    rule__body: seq(
      s.type_value($.type, $.value),
      s.match_cond(
        $.type,
        l(s.var(), s.view__expr_var($.out, $.value)),
        l(s.number(), s.view__expr_number($.out, $.value)),
        l(s.string(), s.view__expr_string($.out, $.value)),
        l(s.box(), s.view__expr_box($.out, $.value)),
      ),
    ),
  },

  view__any_field: {
    rule__params: l($.out, $.field, $.id),
    rule__body: seq(
      s.value_record_field($.value, $.id, $.field),
      s.expr(
        $.out,
        s.view__html("div", l(), s.children(s.view__expr($.value))),
      ),
    ),
  },

  view__any_record: {
    file__name: "Default viewer",
    view__schema: "any_record",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      //
      s.expr(
        $.out,
        s.view__table(
          l(),
          s.children(
            s.view__table_section(
              l(),
              s.children(s.view__string("Field"), s.view__string("Value")),
              s.children(
                s.view__table_row(
                  l(),
                  s.children(s.view__string("id"), s.view__string($.id)),
                ),
                s.expr_iter(
                  s.field_record($.field, $.id),
                  s.view__table_row(
                    l(),
                    s.children(
                      s.view__file_link($.field),
                      s.view__any_field($.field, $.id),
                    ),
                  ),
                ),
              ),
            ),
            s.view__table_section(
              l(),
              s.children(s.view__string("Reference"), s.view__string("Record")),
              s.children(
                s.expr_iter(
                  s.ref_field_record($.ref, $.field, $.id),
                  s.view__table_row(
                    l(),
                    s.children(
                      s.view__file_link($.field),
                      s.view__string($.ref),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;
