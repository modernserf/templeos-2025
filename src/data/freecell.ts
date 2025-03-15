import { l, s, $, __, u, seq, alt, f } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const freeCell = pkg("free_cell", {
  _game: {
    db__schema: "schema",
    file__name: "FreeCell game",
    schema__fields: l(
      s.field("_game_state"),
      s.field("_undo_state"),
      s.field("time__created"),
      // TODO: game stats
    ),
  },
  _game_state: {
    db__schema: "field",
    file__name: "FreeCell game state",
  },
  _undo_state: {
    db__schema: "field",
    file__name: "FreeCell undo history",
  },
  _new_game: {
    file__name: "New Game",
    schema__constructor: "_game",
    rule__params: l($.id),
    rule__body: seq(
      s.var_expr($.id, s.id()),
      s.timestamp($.ts),
      s._init($.value),
      s.db__update(
        l(
          s.update($.id, "_game_state", $.value),
          s.update($.id, "_undo_state", l()),
          s.update($.id, "time__created", $.ts),
          s.update($.id, "db__schema", "_game"),
        ),
      ),
    ),
  },
  _init: {
    rule__params: l(
      s.state(
        s.stacks(s.empty("A"), s.empty("A"), s.empty("A"), s.empty("A")),
        s.cells(s.empty(""), s.empty(""), s.empty(""), s.empty("")),
        s.columns($.a, $.b, $.c, $.d, $.e, $.f, $.g, $.h),
      ),
    ),
    rule__body: seq(
      s.collect_item_in(
        $.cards,
        s.card($.suit, $.rank),
        seq(
          s($.suit).in(l(s.clubs(), s.spades(), s.hearts(), s.diamonds())),
          s.number_min_max($.rank, 1, 13),
        ),
      ),
      s._shuffled_list($.shuffled, $.cards),
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
  // TODO: random seed
  _shuffled_list: {
    rule__params: l($.shuffled, $.list),
    rule__body: seq(
      s.collect_item_in(
        $.with_rand,
        l($.rand, $.item),
        seq(s($.item).in($.list), s.random($.rand)),
      ),
      s.sort($.sorted, $.with_rand, s.ord()),
      s.collect_item_in($.shuffled, $.item, s(l(__, $.item)).in($.sorted)),
    ),
  },

  _view_card_label: {
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
  _view_card: {
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
        l(s.card($.suit, $.rank), s._view_card_label($.label, $.suit, $.rank)),
        l(s.empty($.label), s.ok()),
      ),

      s.view__button($.out, $.props, $.label, s.on_click($.handler)),
    ),
  },
  _view_columns: {
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
                s._view_card(
                  $.card,
                  u($.selected, s.columns($.x, $.y)),
                  s.call($.handler, s.columns($.x, $.y)),
                ),
              ),
              l(
                s._view_card(
                  s.empty(""),
                  u($.selected, s.columns($.x, $.y)),
                  s.call($.handler, s.columns($.x, $.y)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _view_stacks: {
    rule__params: l($.out, $.stacks, $.selected, $.handler),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        s.expr_iter(
          s.value_box_index($.card, $.stacks, $.i),
          s._view_card(
            $.card,
            u($.selected, s.stacks($.i)),
            s.call($.handler, s.stacks($.i)),
          ),
        ),
      ),
    ),
  },
  _view_cells: {
    rule__params: l($.out, $.cells, $.selected, $.handler),
    rule__body: seq(
      s.row(
        $.out,
        l(),
        s.expr_iter(
          s.value_box_index($.card, $.cells, $.i),
          s._view_card(
            $.card,
            u($.selected, s.cells($.i)),
            s.call($.handler, s.cells($.i)),
          ),
        ),
      ),
    ),
  },
  _view_game: {
    file__name: "FreeCell",
    view__subject: s.schema("_game"),
    rule__params: l($.out, $.id, $.p),
    rule__body: seq(
      f._game_state($.id, s.state($.stacks, $.cells, $.columns)),
      s._selected_param($.selected, $.p),
      u($.handler, s._dispatch($.id, $.p)),
      s.column(
        $.out,
        l(s.style("padding", "0.5rem"), s.style("gap", "0.5rem")),
        s.row(
          l(),
          s._view_stacks($.stacks, $.selected, $.handler),
          s._view_cells($.cells, $.selected, $.handler),
        ),
        s._view_columns($.columns, $.selected, $.handler),
        s.row(
          l(s.style("gap", "0.5rem")),
          s.view__button(l(), "Undo", s.on_click(s.call($.handler, s.undo()))),
          s.view__button(
            l(),
            "Reset",
            s.on_click(s.call($.handler, s.reset())),
          ),
          s.view__button(l(), "Auto", s.on_click(s.call($.handler, s.auto()))),
        ),
      ),
    ),
  },

  _suit_color: {
    rule__params: l($.suit, $.color),
    rule__body: alt(
      u(l($.suit, $.color), l(s.clubs(), s.black())),
      u(l($.suit, $.color), l(s.spades(), s.black())),
      u(l($.suit, $.color), l(s.hearts(), s.red())),
      u(l($.suit, $.color), l(s.diamonds(), s.red())),
    ),
  },
  _col_pair: {
    rule__params: l(s.card($.lsuit, $.lrank), s.card($.rsuit, $.rrank)),
    rule__body: seq(
      s.inc($.rrank, $.lrank),
      s._suit_color($.lsuit, $.lcolor),
      s._suit_color($.rsuit, $.rcolor),
      s.not_equal($.lcolor, $.rcolor),
    ),
  },
  _test_col_pair: {
    test__group: "free_cell",
    rule__params: l(),
    rule__body: seq(
      test.ok(s._col_pair(s.card(s.diamonds(), 1), s.card(s.clubs(), 2))),
      test.fail(s._col_pair(s.card(s.diamonds(), 1), s.card(s.hearts(), 2))),
      test.fail(s._col_pair(s.card(s.diamonds(), 1), s.card(s.clubs(), 3))),
    ),
  },
  _move_column_unchecked: {
    rule__params: l($.with, $.without, $.card, $.x),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index($.col, $.without, $.x),
        s.if_then_else(
          s.empty($.col),
          s.updated_box_index_value($.with, $.without, $.x, l($.card)),
          seq(
            s.append_left_right($.next_col, $.col, l($.card)),
            s.updated_box_index_value($.with, $.without, $.x, $.next_col),
          ),
        ),
      ),
      seq(
        s.value_box_index($.col, $.with, $.x),
        s.append_left_right($.col, $.rest, l($.card)),
        s.updated_box_index_value($.without, $.with, $.x, $.rest),
      ),
    ),
  },
  _check_put_column: {
    rule__params: l($.with, $.without, $.card, $.x),
    rule__body: seq(
      s.value_box_index($.col, $.without, $.x),
      s.cond(
        s.empty($.col),
        seq(
          s.append_left_right($.col, __, l($.top)),
          s._col_pair($.card, $.top),
        ),
      ),
    ),
  },
  // TODO: handle moving multiple cards
  _move_column: {
    rule__params: l($.with, $.without, $.card, $.x),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s._check_put_column($.with, $.without, $.card, $.x),
        s._move_column_unchecked($.with, $.without, $.card, $.x),
      ),
      s._move_column_unchecked($.with, $.without, $.card, $.x),
    ),
  },
  _move_cell: {
    rule__params: l($.with, $.without, $.card, $.i),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index(s.empty(__), $.without, $.i),
        s.updated_box_index_value($.with, $.without, $.i, $.card),
      ),
      seq(
        s.value_box_index($.card, $.with, $.i),
        s.not_equal($.card, s.empty(__)),
        s.updated_box_index_value($.without, $.with, $.i, s.empty("")),
      ),
    ),
  },
  _inc_stack: {
    rule__params: l($.low, $.high),
    rule__body: seq(
      s.match_cond(
        l($.low, $.high),
        l(l(s.empty("A"), s.card(__, 1)), s.ok()),
        l(
          l(s.card($.suit, $.lrank), s.card($.suit, $.rrank)),
          s.inc($.rrank, $.lrank),
        ),
        l(__, s.fail()),
      ),
    ),
  },
  _move_stack: {
    rule__params: l($.with, $.without, $.card, $.i),
    rule__body: s.if_then_else(
      s.var($.with),
      seq(
        s.value_box_index($.stack, $.without, $.i),
        s._inc_stack($.stack, $.card),
        s.updated_box_index_value($.with, $.without, $.i, $.card),
      ),
      seq(
        s.value_box_index($.card, $.with, $.i),
        s._inc_stack($.stack, $.card),
        s.updated_box_index_value($.without, $.with, $.i, $.stack),
      ),
    ),
  },
  _move: {
    rule__params: l($.with, $.without, $.card, $.selected),
    rule__body: seq(
      u(s.state($.stacks_wo, $.cells_wo, $.columns_wo), $.without),
      u(s.state($.stacks_w, $.cells_w, $.columns_w), $.with),
      s.match_cond(
        $.selected,
        l(
          s.columns($.x, __),
          seq(
            s._move_column($.columns_w, $.columns_wo, $.card, $.x),
            u(l($.stacks_wo, $.cells_wo), l($.stacks_w, $.cells_w)),
          ),
        ),
        l(
          s.cells($.i),
          seq(
            s._move_cell($.cells_w, $.cells_wo, $.card, $.i),
            u(l($.stacks_wo, $.columns_wo), l($.stacks_w, $.columns_w)),
          ),
        ),
        l(
          s.stacks($.i),
          seq(
            s._move_stack($.stacks_w, $.stacks_wo, $.card, $.i),
            u(l($.columns_wo, $.cells_wo), l($.columns_w, $.cells_w)),
          ),
        ),
      ),
    ),
  },
  _move_undo: {
    file__description: l("undoing a column move is not a valid player move"),
    rule__params: l($.with, $.without, $.card, $.selected),
    rule__body: seq(
      s.match_cond(
        $.selected,
        l(
          s.columns($.x, __),
          seq(
            u(s.state($.stacks_wo, $.cells_wo, $.columns_wo), $.without),
            u(s.state($.stacks_w, $.cells_w, $.columns_w), $.with),
            s._move_column_unchecked($.columns_w, $.columns_wo, $.card, $.x),
            u(l($.stacks_wo, $.cells_wo), l($.stacks_w, $.cells_w)),
          ),
        ),
        l(__, s._move($.with, $.without, $.card, $.selected)),
      ),
    ),
  },
  _auto_moves: {
    rule__params: l($.move),
    rule__body: seq(
      s.number_min_max($.s, 0, 3),
      alt(
        seq(
          s.number_min_max($.c, 0, 3),
          u($.move, s.move(s.stacks($.s), s.cells($.c))),
        ),
        seq(
          s.number_min_max($.x, 0, 7),
          u($.move, s.move(s.stacks($.s), s.columns($.x, 0))),
        ),
      ),
    ),
  },
  _on_auto: {
    rule__params: l($.id),
    rule__body: s.spawn_link(
      __,
      seq(
        f._game_state($.id, $.state),
        s.limit(
          1,
          seq(s._auto_moves($.move), s._on_update_state($.id, $.move)),
        ),
        s.sleep(300),
        s._on_auto($.id),
      ),
    ),
  },
  _on_update_state: {
    rule__params: l($.id, s.move($.to, $.from)),
    rule__body: seq(
      f._undo_state($.id, $.prev_undo),
      s.append_left_right($.next_undo, $.prev_undo, l(s.move($.to, $.from))),
      f._game_state($.id, $.state),
      s._move($.state, $.state2, $.card, $.from),
      s._move($.state3, $.state2, $.card, $.to),
      s.db__update(
        l(
          s.update($.id, "_game_state", $.state3),
          s.update($.id, "_undo_state", $.next_undo),
        ),
      ),
    ),
  },
  _on_undo: {
    rule__params: l($.id),
    rule__body: seq(
      f._undo_state($.id, $.prev_undo),
      s.append_left_right($.prev_undo, $.next_undo, l(s.move($.to, $.from))),
      f._game_state($.id, $.state),
      s._move($.state, $.state2, $.card, $.to),
      s._move_undo($.state3, $.state2, $.card, $.from),
      s.db__update(
        l(
          s.update($.id, "_game_state", $.state3),
          s.update($.id, "_undo_state", $.next_undo),
        ),
      ),
    ),
  },
  _on_reset: {
    rule__params: l($.id),
    rule__body: seq(
      // TODO: only apply DB updates once
      s._on_undo($.id),
      s.sleep(1),
      s._on_reset($.id),
    ),
  },

  _selected_param: {
    rule__params: l($.selected, $.params),
    rule__body: s.get_state(
      l(s.selected($.selected)),
      $.params,
      l(s.selected(s.none())),
    ),
  },
  _clear_selection: {
    rule__params: l($.params),
    rule__body: s.set_state($.params, l(s.selected(s.none()))),
  },
  _dispatch: {
    rule__params: l($.event, $.id, $.params),
    rule__body: seq(
      s._selected_param($.selected, $.params),
      s.match_cond(
        l($.event, $.selected),
        l(
          l(s.reset(), __),
          seq(s._clear_selection($.params), s._on_reset($.id)),
        ),
        l(l(s.auto(), __), seq(s._clear_selection($.params), s._on_auto($.id))),
        l(l(s.undo(), __), seq(s._clear_selection($.params), s._on_undo($.id))),
        l(
          l($.next_selected, s.none()),
          s.set_state($.params, l(s.selected($.next_selected))),
        ),
        l(
          l($.to, $.from),
          seq(
            s._clear_selection($.params),
            s._on_update_state($.id, s.move($.to, $.from)),
          ),
        ),
      ),
    ),
  },
});
