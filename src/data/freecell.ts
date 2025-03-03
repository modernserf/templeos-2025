import { l, s, $, __, u, seq, alt, f } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const freeCell = pkg("free_cell", {
  free_cell__game: {
    db__schema: "schema",
    file__name: "FreeCell game",
    db__fields: l(
      s.field("free_cell__game_state"),
      s.field("free_cell__init_state"),
      s.field("time__created"),
      // TODO: move history, game stats
    ),
  },
  free_cell__game_state: {
    db__schema: "field",
    file__name: "FreeCell game state",
  },
  free_cell__init_state: {
    db__schema: "field",
    file__name: "FreeCell init state",
  },
  // TODO: free_cell__game schema record renders this
  free_cell: {
    db__schema: "form",
    file__name: "FreeCell",
    rule__params: l($.out, $.id, $.params),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.view__string("Current games"),
        s.expr_iter(
          f.db__schema($.game, "free_cell__game"),
          s.view__file_link($.game),
        ),
        s.view__button(
          l(),
          "New game",
          seq(
            s._new_game($.new_game),
            s.current_window($.window),
            s.on__push($.window, s.location($.new_game)),
          ),
        ),
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

  // private
  _new_game: {
    rule__params: l($.id),
    rule__body: seq(
      s.if_var($.id, s.id($.id)),
      s.timestamp($.ts),
      s._init($.value),
      s.db__update(
        l(
          s.update($.id, "free_cell__game_state", $.value),
          s.update($.id, "free_cell__init_state", $.value),
          s.update($.id, "time__created", $.ts),
          s.update($.id, "db__schema", "free_cell__game"),
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
          s.value_box_index(
            $.suit,
            l(s.clubs(), s.spades(), s.hearts(), s.diamonds()),
            __,
          ),
          s.number_min_max($.rank, 1, 13),
        ),
      ),
      // TODO: random seed
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

      s.view__button(
        $.out,
        $.props,
        $.label,
        seq(s.receive(s.click(__)), $.handler),
      ),
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
                  s.fncall($.handler, s.columns($.x, $.y)),
                ),
              ),
              l(
                s._view_card(
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
            s.fncall($.handler, s.stacks($.i)),
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
            s.fncall($.handler, s.cells($.i)),
          ),
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
      s.add__primitive($.rrank, $.lrank, 1),
      s._suit_color($.lsuit, $.lcolor),
      s._suit_color($.rsuit, $.rcolor),
      s("/=", $.lcolor, $.rcolor),
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
  // TODO: handle moving multiple cards
  _move_column: {
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
            s._col_pair($.card, $.top),
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
        s("/=", $.card, s.empty(__)),
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
          s.add__primitive($.rrank, $.lrank, 1),
        ),
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
  _take: {
    rule__params: l($.ns, $.prev_state, $.card, $.selected),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns), $.prev_state),
      s.match_cond(
        $.selected,
        l(
          s.columns($.x, $.y),
          seq(
            s._move_column($.columns, $.next_cols, $.card, $.x, $.y),
            u($.ns, s.state($.stacks, $.cells, $.next_cols)),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s._move_cell($.cells, $.next_cells, $.card, $.c),
            u($.ns, s.state($.stacks, $.next_cells, $.columns)),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s._move_stack($.stacks, $.next_stacks, $.card, $.s),
            u($.ns, s.state($.next_stacks, $.cells, $.columns)),
          ),
        ),
      ),
    ),
  },
  _put: {
    rule__params: l($.ns, $.prev_state, $.card, $.target),
    rule__body: seq(
      u(s.state($.stacks, $.cells, $.columns), $.prev_state),
      s.match_cond(
        $.target,
        l(
          s.columns($.x, $.y),
          seq(
            s._move_column($.next_cols, $.columns, $.card, $.x, $.y),
            u($.ns, s.state($.stacks, $.cells, $.next_cols)),
          ),
        ),
        l(
          s.cells($.c),
          seq(
            s._move_cell($.next_cells, $.cells, $.card, $.c),
            u($.ns, s.state($.stacks, $.next_cells, $.columns)),
          ),
        ),
        l(
          s.stacks($.s),
          seq(
            s._move_stack($.next_stacks, $.stacks, $.card, $.s),
            u($.ns, s.state($.next_stacks, $.cells, $.columns)),
          ),
        ),
      ),
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
  _dispatch: {
    rule__params: l($.event, $.id, $.params),
    rule__body: seq(
      s._selected_param($.selected, $.params),
      s.cond(
        l(
          u($.event, s.reset()),
          seq(
            f.free_cell__init_state($.id, $.init_state),
            s.db__update(
              l(s.update($.id, "free_cell__game_state", $.init_state)),
            ),
          ),
        ),
        l(
          u($.selected, s.none()),
          s.set_state($.params, l(s.selected($.event))),
        ),
        l(
          seq(
            f.free_cell__game_state($.id, $.state),
            s._take($.state2, $.state, $.card, $.selected),
            s._put($.state3, $.state2, $.card, $.event),
          ),
          seq(
            s.db__update(l(s.update($.id, "free_cell__game_state", $.state3))),
            s.set_state($.params, l(s.selected(s.none()))),
          ),
        ),
        l(s.ok(), s.set_state($.params, l(s.selected(s.none())))),
      ),
    ),
  },
  _view_game: {
    view__schema: "free_cell__game",
    file__name: "FreeCell",
    rule__params: l($.out, $.id, $.p),
    rule__body: seq(
      f.free_cell__game_state($.id, s.state($.stacks, $.cells, $.columns)),
      s._selected_param($.selected, $.p),
      u($.handler, s.fn($.e, s._dispatch($.e, $.id, $.p))),
      s.column(
        $.out,
        l(s.style("padding", "1rem")),
        s.row(
          l(s.style("paddingBottom", "0.5rem")),
          s._view_stacks($.stacks, $.selected, $.handler),
          s._view_cells($.cells, $.selected, $.handler),
        ),
        s._view_columns($.columns, $.selected, $.handler),
        s.row(
          l(s.style("paddingTop", "1rem")),
          s.view__button(l(), "Reset", s.fncall($.handler, s.reset())),
        ),
      ),
    ),
  },
});
