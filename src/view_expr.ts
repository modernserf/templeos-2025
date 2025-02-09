import { Rec } from "./data";
import { l, r, s, $, __, view } from "./expr";

export const viewExpr = {
  expr_tuple: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: r(
      view.render(
        view.wrap(
          l(),
          s.children(
            view.file_link($.tag),
            view.row(
              l(s.class("Parens")),
              s.children(
                view.iter(
                  r(s.list_item($.list, $.expr), view.expr($.expr, $.rendered)),
                  l(view.output($.rendered), view.string(" ")),
                ),
              ),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  expr_tuple_block: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: r(
      view.render(
        view.row(
          l(),
          s.children(
            view.file_link($.tag),
            view.column(
              l(s.class("Parens")),
              s.children(
                view.iter(
                  r(s.list_item($.list, $.item), view.expr($.item, $.expr_out)),
                  l(
                    view.row(
                      l(s.class("TupleBlockRow")),
                      s.children(view.output($.expr_out)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  expr_struct: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: s.cond(
      l(
        s.match($.tag, "do", "fork", "children", "cond", "match_cond"),
        view.expr_tuple_block($.tag, $.list, $.out),
      ),
      l(s.ok(), view.expr_tuple($.tag, $.list, $.out)),
    ),
  },
  expr: {
    rule__params: l($.data, $.out),
    rule__body: s.fork(
      r(
        s.string($.data),
        view.render(
          view.html(
            "span",
            l(),
            s.children(view.string('"'), view.string($.data), view.string('"')),
          ),
          $.out,
        ),
      ),
      r(s.number($.data), view.string($.data, $.out)),
      r(
        s.struct_tag_list($.data, $.tag, $.list),
        view.expr_struct($.tag, $.list, $.out),
      ),
      r(
        s.var_name($.data, $.var_name),
        view.render(
          view.html(
            "span",
            l(s.class("VarExpr")),
            s.children(view.string($.var_name)),
          ),
          $.out,
        ),
      ),
    ),
  },

  struct_add_field: {
    rule__params: l($.on_change, $.out),
    rule__body: r(
      view.menu(
        "+",
        l(
          s.option("string", "string"),
          s.option("number", "number"),
          s.option("struct", "struct"),
          s.option("var", "var"),
        ),
        l(
          s.change($.next_type),
          r(
            s.match(
              l($.next_type, $.next),
              l("string", ""),
              l("number", 0),
              l("struct", l()),
              l("var", $("")),
            ),
            view.dispatch($.on_change, $.next),
          ),
        ),
        $.out,
      ),
    ),
  },
  struct_nodes_edit: {
    rule__params: l($.data, $.on_change, $.out),
    rule__body: r(
      s.struct_tag_list($.data, $.id, $.args),
      s.struct_at_value($.data, $.i, $.arg),
      // sensitive to quotation
      view.expr_edit(
        $.arg,
        l(
          $.arg_next,
          r(
            s.struct_at_value_updated($.data, $.i, $.arg_next, $.next),
            view.dispatch($.on_change, $.next),
          ),
        ),
        $.expr_edit,
      ),
      view.render(
        view.row(
          l(),
          s.children(
            view.button(
              l(s.class("DeleteExpr")),
              "×",
              l(
                s.click(__),
                r(
                  s.list_at_removed_splice($.args, $.i, l(__), $.next_args),
                  s.struct_tag_list($.next, $.id, $.next_args),
                  view.dispatch($.on_change, $.next),
                ),
              ),
            ),
            view.output($.expr_edit),
          ),
        ),
        $.out,
      ),
    ),
  },
  struct_tag_edit: {
    rule__params: l($.data, $.on_change, $.out),
    rule__body: r(
      s.struct_tag_list($.data, $.id, $.args),
      view.fit_content_input(
        $.id,
        l(
          s.change($.next_id),
          r(
            s.struct_tag_list($.next, $.next_id, $.args),
            view.dispatch($.on_change, $.next),
          ),
        ),
        $.out,
      ),
    ),
  },
  struct_edit: {
    rule__params: l($.data, $.on_change, $.out),
    rule__body: view.render(
      view.row(
        l(),
        s.children(
          view.struct_tag_edit(s.quote($.data), $.on_change),
          view.column(
            l(s.class("Parens")),
            s.children(
              view.struct_nodes_edit(s.quote($.data), $.on_change),
              view.struct_add_field(
                l(
                  $.next_arg,
                  r(
                    s._struct_push($.data, $.next_arg, $.next),
                    view.dispatch($.on_change, $.next),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },

  __expr_edit: {
    rule__params: l($.data, $.on_change, $.out),
    rule__body: s.fork(
      r(
        s.var_name($.data, $.var_name),
        view.fit_content_input(
          $.var_name,
          l(s.change($.next), s.log("todo: change var name", $.next)),
          $.out,
        ),
      ),
      r(
        s.string($.data),
        view.fit_content_input(
          $.data,
          l(s.change($.next), view.dispatch($.on_change, $.next)),

          $.out,
        ),
      ),
      r(
        s.number($.data),
        view.fit_content_input(
          $.data,
          l(
            s.change($.next_str),
            r(
              s.string_number($.next_str, $.next),
              view.dispatch($.on_change, $.next),
            ),
          ),
          $.out,
        ),
      ),
      r(s.struct($.data), view.struct_edit($.data, $.on_change, $.out)),
    ),
  },
  expr_edit: {
    rule__params: l($.data, $.on_change, $.out),
    rule__body: r(
      s.try_error_catch(
        view.__expr_edit($.data, $.on_change, $.out),
        $.error,
        r(s.log("error", $.error), view.string("<error>", $.out)),
      ),
    ),
  },
} satisfies Record<string, Rec>;
