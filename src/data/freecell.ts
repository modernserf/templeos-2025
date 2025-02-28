import { Rec } from ".";
import { l, s, $, __, u, seq } from "../expr";
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
    rule__body: s.match(
      l($.suit, $.color),
      l(s.clubs(), s.black()),
      l(s.spades(), s.black()),
      l(s.hearts(), s.red()),
      l(s.diamonds(), s.red()),
    ),
  },
  free_cell__inc_stack: {
    rule__params: l($.low, $.high),
    rule__body: seq(
      // at some point I will have to implement math
      s.match(
        l($.low, $.high),
        l(s.empty(__), s.card(__, 1)),
        l(s.card($.suit, 1), s.card($.suit, 2)),
        l(s.card($.suit, 2), s.card($.suit, 3)),
        l(s.card($.suit, 3), s.card($.suit, 4)),
        l(s.card($.suit, 4), s.card($.suit, 5)),
        l(s.card($.suit, 5), s.card($.suit, 6)),
        l(s.card($.suit, 6), s.card($.suit, 7)),
        l(s.card($.suit, 7), s.card($.suit, 8)),
        l(s.card($.suit, 8), s.card($.suit, 9)),
        l(s.card($.suit, 9), s.card($.suit, 10)),
        l(s.card($.suit, 10), s.card($.suit, 11)),
        l(s.card($.suit, 11), s.card($.suit, 12)),
        l(s.card($.suit, 12), s.card($.suit, 13)),
      ),
    ),
  },
  free_cell__movable_col__: {
    rule__params: l($.col, s.card($.last_suit, $.last_rank)),
    rule__body: s.if_then_else(
      s.empty($.col),
      s.ok(),
      seq(
        s.append_left_right($.col, $.rest, l(s.card($.next_suit, $.next_rank))),
        s.free_cell__suit_color($.last_suit, $.color),
        s.free_cell__suit_color($.next_suit, $.other_color),
        s.if_then_else(u($.color, $.other_color), s.fail(), s.ok()),
        s.free_cell__inc_stack(
          s.card(__, $.last_rank),
          s.card(__, $.next_rank),
        ),
        s.free_cell__movable_col__($.rest, s.card($.next_suit, $.next_rank)),
      ),
    ),
  },
  free_cell__movable_col: {
    rule__params: l($.col),
    rule__body: seq(
      s.append_left_right($.col, $.rest, l($.last)),
      s.free_cell__movable_col__($.rest, $.last),
    ),
  },
  test__free_cell__movable_col: {
    test__group: "free_cell",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.free_cell__movable_col(l(s.card(s.diamonds(), 1)))),
      test.ok(
        s.free_cell__movable_col(
          l(s.card(s.clubs(), 2), s.card(s.diamonds(), 1)),
        ),
      ),
      test.fail(
        s.free_cell__movable_col(
          l(s.card(s.hearts(), 2), s.card(s.diamonds(), 1)),
        ),
      ),
      test.fail(
        s.free_cell__movable_col(
          l(s.card(s.clubs(), 3), s.card(s.diamonds(), 1)),
        ),
      ),
    ),
  },
  free_cell__take_col: {
    rule__params: l($.next, $.top, $.cols, $.x, $.y),
    rule__body: seq(
      s.value_box_index($.col, $.cols, $.x),
      s.left_right_box_split($.rest, $.top, $.col, $.y),
      s.free_cell__movable_col($.top),
      s.updated_box_index_value($.next, $.cols, $.x, $.rest),
    ),
  },
  free_cell__put_col: {
    rule__params: l($.next, $.cols, $.added, $.x, __),
    rule__body: seq(
      s.value_box_index($.col, $.cols, $.x),
      s.if_then_else(
        s.empty($.col),
        s.updated_box_index_value($.next, $.cols, $.x, $.added),
        seq(
          s.append_left_right($.col, $.rest, l($.top)),
          s.append_left_right($.next_top, l($.top), $.added),
          s.free_cell__movable_col($.next_top),
          s.append_left_right($.next_col, $.rest, $.next_top),
          s.updated_box_index_value($.next, $.cols, $.x, $.next_col),
        ),
      ),
    ),
  },
  free_cell__take_cell: {
    rule__params: l($.next, $.card, $.cells, $.i),
    rule__body: seq(
      s.value_box_index($.card, $.cells, $.i),
      s.if_then_else(u($.card, s.empty(__)), s.fail(), s.ok()),
      s.updated_box_index_value($.next, $.cells, $.i, s.empty("")),
    ),
  },
  free_cell__put_cell: {
    rule__params: l($.next, $.cells, $.card, $.i),
    rule__body: seq(
      s.value_box_index(s.empty(__), $.cells, $.i),
      s.updated_box_index_value($.next, $.cells, $.i, $.card),
    ),
  },
  free_cell__count_free_cells: {
    rule__params: l($.count, $.cells),
    rule__body: seq(
      s.collect_item_in(
        $.free,
        s.ok(),
        seq(s.value_box_index(s.empty(""), $.cells, __)),
      ),
      s.length_box($.count, $.free),
    ),
  },

  free_cell__take_stack: {
    rule__params: l($.next, $.card, $.stacks, $.i),
    rule__body: seq(
      s.value_box_index($.card, $.stacks, $.i),
      s.free_cell__inc_stack($.next_stack, $.card),
      s.updated_box_index_value($.next, $.stacks, $.i, $.next_stack),
    ),
  },
  free_cell__put_stack: {
    rule__params: l($.next, $.stacks, $.card, $.i),
    rule__body: seq(
      s.value_box_index($.stack, $.stacks, $.i),
      s.free_cell__inc_stack($.stack, $.card),
      s.updated_box_index_value($.next, $.stacks, $.i, $.card),
    ),
  },
  free_cell__take: {
    rule__params: l($.next_state, $.card, $.prev_state),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.prev_state),
      s.match_cond(
        $.selected,
        l(
          s.columns($.x, $.y),
          seq(
            s.free_cell__take_col($.next_cols, l($.card), $.columns, $.x, $.y),
            u(
              $.next_state,
              s.state($.stacks, $.cells, $.next_cols, $.selected),
            ),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s.free_cell__take_cell($.next_cells, $.card, $.cells, $.c),
            u(
              $.next_state,
              s.state($.stacks, $.next_cells, $.columns, $.selected),
            ),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s.free_cell__take_stack($.next_stacks, $.card, $.stacks, $.s),
            u(
              $.next_state,
              s.state($.next_stacks, $.cells, $.columns, $.selected),
            ),
          ),
        ),
      ),
    ),
  },
  free_cell__put: {
    rule__params: l($.next_state, $.card, $.target, $.prev_state),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns, $.selected), $.prev_state),
      s.match_cond(
        $.target,
        l(
          s.columns($.x, $.y),
          seq(
            s.free_cell__put_col($.next_cols, $.columns, l($.card), $.x, $.y),
            u($.next_state, s.state($.stacks, $.cells, $.next_cols, s.none())),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s.free_cell__put_cell($.next_cells, $.cells, $.card, $.c),
            u(
              $.next_state,
              s.state($.stacks, $.next_cells, $.columns, s.none()),
            ),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s.free_cell__put_stack($.next_stacks, $.stacks, $.card, $.s),
            u(
              $.next_state,
              s.state($.next_stacks, $.cells, $.columns, s.none()),
            ),
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
