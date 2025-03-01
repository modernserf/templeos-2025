import { Rec } from ".";
import { l, s, $, __, u, seq, alt } from "../expr";
import { test } from "./test_utils";

export const freeCell = {
  free_cell__init_state: {
    rule__params: l(
      s.state(
        s.stacks(s.empty("A"), s.empty("A"), s.empty("A"), s.empty("A")),
        s.cells(s.empty(""), s.empty(""), s.empty(""), s.empty("")),
        s.columns($.a, $.b, $.c, $.d, $.e, $.f, $.g, $.h),
        s.none(),
      ),
    ),
    rule__body: seq(
      s.collect_item_in(
        $.cards,
        s.card($.suit, $.rank),
        seq(
          s.value_box_index(
            $.suit,
            l(s.clubs(), s.spades(), s.hearts(), s.diamonds()),
            __,
          ),
          s.number_min_max($.rank, 1, 13),
        ),
      ),
      s.shuffled_list($.shuffled, $.cards),
      // 7 card
      s.slice_box_from_to($.a, $.shuffled, 0, 7),
      s.slice_box_from_to($.b, $.shuffled, 7, 14),
      s.slice_box_from_to($.c, $.shuffled, 14, 21),
      s.slice_box_from_to($.d, $.shuffled, 21, 28),
      // 6 card
      s.slice_box_from_to($.e, $.shuffled, 28, 34),
      s.slice_box_from_to($.f, $.shuffled, 34, 40),
      s.slice_box_from_to($.g, $.shuffled, 40, 46),
      s.slice_box_from_to($.h, $.shuffled, 46, 52),
    ),
  },
  view__free_cell_card_label: {
    rule__params: l($.out, $.suit, $.rank),
    rule__body: seq(
      s.match(
        l($.suit, $.icon),
        l(s.clubs(), "♣️"),
        l(s.spades(), "♠️"),
        l(s.hearts(), "♥️"),
        l(s.diamonds(), "♦️"),
      ),
      s.match_cond(
        $.rank,
        l(1, u($.label, "A")),
        l(11, u($.label, "J")),
        l(12, u($.label, "Q")),
        l(13, u($.label, "K")),
        l(__, s.string_number($.label, $.rank)),
      ),
      u($.out, s.Html("span", l(), l(s.String($.icon), s.String($.label)))),
    ),
  },
  view__free_cell_card: {
    rule__params: l($.out, $.card, $.is_selected, $.handler),
    rule__body: seq(
      u(
        $.base_props,
        l(
          s.style("width", "2.5rem"),
          s.style("height", "4rem"),
          s.style("margin", "0.25rem"),
        ),
      ),
      s.if_then_else(
        $.is_selected,
        s.append_left_right(
          $.props,
          $.base_props,
          l(s.style("border", "2px solid black")),
        ),
        u($.props, $.base_props),
      ),
      s.match_cond(
        $.card,
        l(
          s.card($.suit, $.rank),
          s.view__free_cell_card_label($.label, $.suit, $.rank),
        ),
        l(s.empty($.label), s.ok()),
      ),

      s.view__button(
        $.out,
        $.props,
        $.label,
        seq(s.receive(s.click(__)), $.handler),
      ),
    ),
  },
  view__free_cell_columns: {
    rule__params: l($.out, $.columns, $.selected, $.handler),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        s.expr_iter(
          s.value_box_index($.col, $.columns, $.x),
          s.column(
            l(),
            s.expr_iter_else(
              s.value_box_index($.card, $.col, $.y),
              l(
                s.view__free_cell_card(
                  $.card,
                  u($.selected, s.columns($.x, $.y)),
                  s.fncall($.handler, s.columns($.x, $.y)),
                ),
              ),
              l(
                s.view__free_cell_card(
                  s.empty(""),
                  u($.selected, s.columns($.x, $.y)),
                  s.fncall($.handler, s.columns($.x, $.y)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  view__free_cell_stacks: {
    rule__params: l($.out, $.stacks, $.selected, $.handler),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        s.expr_iter(
          s.value_box_index($.card, $.stacks, $.i),
          s.view__free_cell_card(
            $.card,
            u($.selected, s.stacks($.i)),
            s.fncall($.handler, s.stacks($.i)),
          ),
        ),
      ),
    ),
  },
  view__free_cell_cells: {
    rule__params: l($.out, $.cells, $.selected, $.handler),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        s.expr_iter(
          s.value_box_index($.card, $.cells, $.i),
          s.view__free_cell_card(
            $.card,
            u($.selected, s.cells($.i)),
            s.fncall($.handler, s.cells($.i)),
          ),
        ),
      ),
    ),
  },
  free_cell__suit_color: {
    rule__params: l($.suit, $.color),
    rule__body: alt(
      u(l($.suit, $.color), l(s.clubs(), s.black())),
      u(l($.suit, $.color), l(s.spades(), s.black())),
      u(l($.suit, $.color), l(s.hearts(), s.red())),
      u(l($.suit, $.color), l(s.diamonds(), s.red())),
    ),
  },
  free_cell__col_pair: {
    rule__params: l(s.card($.lsuit, $.lrank), s.card($.rsuit, $.rrank)),
    rule__body: seq(
      s.add__primitive($.rrank, $.lrank, 1),
      s.free_cell__suit_color($.lsuit, $.lcolor),
      s.free_cell__suit_color($.rsuit, $.rcolor),
      s("/=", $.lcolor, $.rcolor),
    ),
  },
  test__free_cell__col_pair: {
    test__group: "free_cell",
    rule__params: l(),
    rule__body: seq(
      test.ok(
        s.free_cell__col_pair(s.card(s.diamonds(), 1), s.card(s.clubs(), 2)),
      ),
      test.fail(
        s.free_cell__col_pair(s.card(s.diamonds(), 1), s.card(s.hearts(), 2)),
      ),
      test.fail(
        s.free_cell__col_pair(s.card(s.diamonds(), 1), s.card(s.clubs(), 3)),
      ),
    ),
  },
  // TODO: handle moving multiple cards
  free_cell__move_column: {
    rule__params: l($.with, $.without, $.card, $.x, $.y),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index($.col, $.without, $.x),
        s.if_then_else(
          s.empty($.col),
          s.updated_box_index_value($.with, $.without, $.x, l($.card)),
          seq(
            s.left_right_box_split(__, l($.top), $.col, $.y),
            s.free_cell__col_pair($.card, $.top),
            s.append_left_right($.next_col, $.col, l($.card)),
            s.updated_box_index_value($.with, $.without, $.x, $.next_col),
          ),
        ),
      ),
      seq(
        s.value_box_index($.col, $.with, $.x),
        s.left_right_box_split($.rest, l($.card), $.col, $.y),
        s.updated_box_index_value($.without, $.with, $.x, $.rest),
      ),
    ),
  },
  free_cell__move_cell: {
    rule__params: l($.with, $.without, $.card, $.i),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index(s.empty(__), $.without, $.i),
        s.updated_box_index_value($.with, $.without, $.i, $.card),
      ),
      seq(
        s.value_box_index($.card, $.with, $.i),
        s("/=", $.card, s.empty(__)),
        s.updated_box_index_value($.without, $.with, $.i, s.empty("")),
      ),
    ),
  },
  free_cell__inc_stack: {
    rule__params: l($.low, $.high),
    rule__body: seq(
      s.match_cond(
        l($.low, $.high),
        l(l(s.empty("A"), s.card(__, 1)), s.ok()),
        l(
          l(s.card($.suit, $.lrank), s.card($.suit, $.rrank)),
          s.add__primitive($.rrank, $.lrank, 1),
        ),
      ),
    ),
  },
  free_cell__move_stack: {
    rule__params: l($.with, $.without, $.card, $.i),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index($.stack, $.without, $.i),
        s.free_cell__inc_stack($.stack, $.card),
        s.updated_box_index_value($.with, $.without, $.i, $.card),
      ),
      seq(
        s.value_box_index($.card, $.with, $.i),
        s.free_cell__inc_stack($.stack, $.card),
        s.updated_box_index_value($.without, $.with, $.i, $.stack),
      ),
    ),
  },
  free_cell__take: {
    rule__params: l($.ns, $.card, $.prev_state),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.prev_state),
      s.match_cond(
        $.selected,
        l(
          s.columns($.x, $.y),
          seq(
            s.free_cell__move_column($.columns, $.next_cols, $.card, $.x, $.y),
            u($.ns, s.state($.stacks, $.cells, $.next_cols, $.selected)),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s.free_cell__move_cell($.cells, $.next_cells, $.card, $.c),
            u($.ns, s.state($.stacks, $.next_cells, $.columns, $.selected)),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s.free_cell__move_stack($.stacks, $.next_stacks, $.card, $.s),
            u($.ns, s.state($.next_stacks, $.cells, $.columns, $.selected)),
          ),
        ),
      ),
    ),
  },
  free_cell__put: {
    rule__params: l($.ns, $.card, $.target, $.prev_state),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.prev_state),
      s.match_cond(
        $.target,
        l(
          s.columns($.x, $.y),
          seq(
            s.free_cell__move_column($.next_cols, $.columns, $.card, $.x, $.y),
            u($.ns, s.state($.stacks, $.cells, $.next_cols, s.none())),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s.free_cell__move_cell($.next_cells, $.cells, $.card, $.c),
            u($.ns, s.state($.stacks, $.next_cells, $.columns, s.none())),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s.free_cell__move_stack($.next_stacks, $.stacks, $.card, $.s),
            u($.ns, s.state($.next_stacks, $.cells, $.columns, s.none())),
          ),
        ),
      ),
    ),
  },
  free_cell__dispatch: {
    rule__params: l($.event, $.state, $.params),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.state),

      s.if_then_else(
        u($.selected, s.none()),
        s.set_state($.params, s.state($.stacks, $.cells, $.columns, $.event)),
        s.if_then_else(
          seq(
            s.free_cell__take($.state2, $.card, $.state),
            s.free_cell__put($.state3, $.card, $.event, $.state2),
          ),
          s.set_state($.params, $.state3),
          s.set_state(
            $.params,
            s.state($.stacks, $.cells, $.columns, s.none()),
          ),
        ),
      ),
    ),
  },
  // TODO: game as db record, not param state
  free_cell: {
    db__schema: "form",
    file__name: "FreeCell",
    rule__params: l($.out, $.id, $.params),
    rule__body: seq(
      s.get_state_else(
        s.state($.stacks, $.cells, $.columns, $.selected),
        $.params,
        s.fn($.s, s.free_cell__init_state($.s)),
      ),
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.prev_state),
      u(
        $.handler,
        s.fn($.e, s.free_cell__dispatch($.e, $.prev_state, $.params)),
      ),
      s.column(
        $.out,
        l(s.style("padding", "1rem")),
        s.row(
          l(s.style("paddingBottom", "0.5rem")),
          s.view__free_cell_stacks($.stacks, $.selected, $.handler),
          s.view__free_cell_cells($.cells, $.selected, $.handler),
        ),
        s.view__free_cell_columns($.columns, $.selected, $.handler),
      ),
    ),
  },
  fncall: {
    rule__params: l(s.fn($.params, $.body), $.args),
    rule__body: seq(u($.params, $.args), $.body),
  },
  get_state_else: {
    rule__params: l($.value, $.state, $.fn),
    rule__body: s.if_then_else(
      s.value_record_field($.value, $.state, "history__params"),
      s.ok(),
      s.fncall($.fn, $.value),
    ),
  },
} satisfies Record<string, Rec>;
