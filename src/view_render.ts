import { Rec } from "./data";
import { l, r, s, $, view, u } from "./expr";
import { test } from "./test_utils";

export const viewRender = {
  render: {
    file__description: l(
      "renders a view tree, propagating along ",
      s.code(s.children($.args)),
      ". prevent progagation into children with ",
      s.code(s.quote($.expr)),
      ".",
    ),
    rule__params: l($.expr, $.out),
    rule__body: r(
      s.collect_empty(
        l($.i, $.rendered),
        r(
          s.struct_at_value($.expr, $.i, $.arg),

          s.cond(
            l(
              s.struct_tag_list($.arg, "children", $.children),
              s.collect_empty(
                $.view,
                r(
                  s.list_item($.children, $.child),
                  view.render($.child, $.view),
                ),
                $.rendered,
              ),
            ),
            l(u($.arg, s.quote($.value)), u($.rendered, $.value)),
          ),
        ),
        $.changes,
      ),
      s.struct_changelist_updated($.expr, $.changes, $.updated),
      s.apply($.updated, l($.out)),
    ),
  },
  test_render: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        view.render(view.string("foo"), $.result),
        s.String("foo"),
      ),
      test.collect(
        $.result,
        view.render(
          view.row(l(), s.children(view.string("foo"), view.string("bar"))),
          $.result,
        ),
        s.Html("div", l(s.class("Row")), l(s.String("foo"), s.String("bar"))),
      ),
    ),
  },

  iter: {
    rule__params: l($.iter, $.children, $.out),
    rule__body: r(
      $.iter,
      s.list_item($.children, $.child),
      view.render($.child, $.out),
    ),
  },
  iter_else: {
    rule__params: l($.iter, $.children, $.else, $.out),
    rule__body: s.if_then_else(
      $.iter,
      r(s.list_item($.children, $.child), view.render($.child, $.out)),
      r(s.list_item($.else, $.child), view.render($.child, $.out)),
    ),
  },
  or_default: {
    rule__params: l($.child, $.default, $.out),
    rule__body: s.if_then_else(
      view.render($.child, $.out),
      s.ok(),
      view.render($.default, $.out),
    ),
  },
} satisfies Record<string, Rec>;
