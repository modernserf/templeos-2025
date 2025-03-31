import { l, s, $, __, u, seq, x, xfn, alt, fn } from "../expr";
import { pkg } from "../pkg";

export const { rules: minesweeper } = pkg("minesweeper", {
  _game: {
    db__schema: "schema",
    file__name: "Minesweeper game",
    schema__fields: l(s.field("_state"), s.field("time__created")),
  },
  _new_game: {
    file__name: "New Game",
    schema__constructor: "_game",
    rule__params: l($.id),
    rule__body: seq(
      s.or_default($.id, x.id()),
      s.timestamp($.ts),
      s._create_board($.state, 10, 10, 10),
      s.db__update(s.insert(s._game($.id, $.state, $.ts))),
    ),
  },
  _state: {
    db__schema: "field",
    file__name: "Minesweeper game state",
    field__type: s.list_of(s.list_of(s._tile())),
  },
  _create_board: {
    rule__params: l($.state, $.width, $.height, $.bomb_count),
    rule__body: seq(
      s._bomb_coordinates($.bombs, l(), $.width, $.height, $.bomb_count),
      s.collect_item_in(
        $.state,
        $.row,
        seq(
          s.number_min_to($.y, 0, $.height),
          s.collect_item_in(
            $.row,
            $.tile,
            seq(
              s.number_min_to($.x, 0, $.width),
              s.if_then_else(
                s.has(l($.x, $.y), $.bombs),
                u($.tile, s.tile(s.hidden(), s.bomb())),
                u($.tile, s.tile(s.hidden(), s.empty())),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _bomb_coordinates: {
    rule__params: l($.coords, $.prev, $.width, $.height, $.count),
    rule__body: s.if_then_else(
      u($.count, 0),
      u($.coords, $.prev),
      seq(
        s.random_int($.x, x.sub($.width, 1)),
        s.random_int($.y, x.sub($.height, 1)),
        // TODO: set union
        s.none(s.has(l($.x, $.y), $.prev)),
        s.append($.next, $.prev, l(l($.x, $.y))),
        s._bomb_coordinates(
          $.coords,
          $.next,
          $.width,
          $.height,
          x.sub($.count, 1),
        ),
      ),
    ),
  },
  _test_bomb_coordinates: {
    test__group: "minesweeper",
    rule__params: l(),
    rule__body: seq(
      s._bomb_coordinates($.c1, l(), 10, 10, 0),
      s.expect_eq($.c1, l()),

      s._bomb_coordinates($.c2, l(l(1, 1)), 10, 10, 0),
      s.expect_eq($.c2, l(l(1, 1))),

      s._bomb_coordinates($.c3, l(), 10, 10, 10),
      s.expect_eq(x.length($.c3), 10),
    ),
  },

  _tile: {
    rule_params: l($.t),
    rule__body: s.enum($.t, s.tile(s._tile_state(), s._tile_content())),
  },
  _tile_state: {
    rule__params: l($.t),
    rule__body: s.enum($.t, s.hidden(), s.revealed(), s.flagged()),
  },
  _tile_content: {
    rule__params: l($.t),
    rule__body: s.enum($.t, s.empty(), s.bomb()),
  },
  _e_click: {
    rule__params: l($.t),
    rule__body: s.enum(
      $.t,
      s.click(s.number(), s.number()),
      s.flag(s.number(), s.number()),
    ),
  },
  _state_at: {
    rule__params: l($.tile, $.state, l($.x, $.y)),
    rule__body: seq(s.at($.row, $.state, $.y), s.at($.tile, $.row, $.x)),
  },
  _updated_at: {
    rule__params: l($.next, $.state, $.x, $.y, $.fn),
    rule__body: s.updated_box_index_fn(
      $.next,
      $.state,
      $.y,
      s.updated_box_index_fn($.x, $.fn),
    ),
  },
  _state_has: {
    rule__params: l($.value, $.state),
    rule__body: s.if_then_else(
      s.empty($.state),
      s.fail(),
      seq(
        s.append($.state, l($.h), $.t),
        s.if_then_else(s.has($.value, $.h), s.ok(), s._state_has($.value, $.t)),
      ),
    ),
  },
  _neighbor: {
    rule__params: l($.n, l($.x, $.y)),
    rule__body: alt(
      u($.n, x.list(x.sub($.x, 1), x.sub($.y, 1))),
      u($.n, x.list(x.sub($.x, 1), $.y)),
      u($.n, x.list(x.sub($.x, 1), x.add($.y, 1))),

      u($.n, x.list($.x, x.sub($.y, 1))),
      u($.n, x.list($.x, x.add($.y, 1))),

      u($.n, x.list(x.add($.x, 1), x.sub($.y, 1))),
      u($.n, x.list(x.add($.x, 1), $.y)),
      u($.n, x.list(x.add($.x, 1), x.add($.y, 1))),
    ),
  },
  _bomb_neighbors: {
    rule__params: l($.count, $.state, $.x, $.y),
    rule__body: seq(
      s.collect_item_in(
        $.bombs,
        $.tile,
        seq(
          s._neighbor($.n, l($.x, $.y)),
          s._state_at($.tile, $.state, $.n),
          u(s.tile(__, s.bomb()), $.tile),
        ),
      ),
      s.length($.count, $.bombs),
    ),
  },
  _tile_label: {
    rule__params: l($.label, $.state, $.x, $.y),
    rule__body: seq(
      s._state_at($.tile, $.state, l($.x, $.y)),
      s.match_cond(
        $.tile,
        l(s.tile(s.hidden(), __), u($.label, "")),
        l(s.tile(s.flagged(), __), u($.label, "⛳️")),
        l(
          s.tile(s.revealed(), s.empty()),
          seq(
            s._bomb_neighbors($.count, $.state, $.x, $.y),
            s.string_number($.label, $.count),
          ),
        ),
        l(s.tile(s.revealed(), s.bomb()), u($.label, "💣")),
      ),
    ),
  },
  _view_tile: {
    rule__params: l($.out, $.state, $.x, $.y, $.on_click),
    rule__body: s.view__button(
      $.out,
      l(s.style("width", "2rem"), s.style("height", "2rem")),
      x._tile_label($.state, $.x, $.y),
      fn(s.click($.params))(
        s.if_then_else(
          s.has(s.meta_key(), $.params),
          s.call($.on_click, s.flag($.x, $.y)),
          s.call($.on_click, s.reveal($.x, $.y)),
        ),
      ),
    ),
  },
  _view_game: {
    db__schema: "view",
    file__name: "Minesweeper",
    view__subject: s.schema("_game"),
    rule__params: l($.out, $.id, __),
    rule__body: seq(
      s._state($.state, $.id),
      s.column(
        $.out,
        l(),
        xfn($.o)(
          s.index_value_box($.y, $.row, $.state),
          s.row(
            $.o,
            l(),
            xfn($.o1)(
              s.index_value_box($.x, __, $.row),
              s._view_tile($.o1, $.state, $.x, $.y, s._on_click($.id)),
            ),
          ),
        ),
      ),
    ),
  },
  _game_win: {
    rule__params: l($.mode, $.state),
    rule__body: s.cond(
      l(
        s._state_has(s.tile(s.revealed(), s.bomb()), $.state),
        u($.mode, s.lose()),
      ),
      l(
        s._state_has(s.tile(s.hidden(), s.empty()), $.state),
        u($.mode, s.pending()),
      ),
      l(
        s._state_has(s.tile(s.flagged(), s.empty()), $.state),
        u($.mode, s.pending()),
      ),
      u($.mode, s.win()),
    ),
  },
  _on_flag: {
    rule__params: l(s.tile($.next, $.content), s.tile($.prev, $.content)),
    rule__body: s.match(
      l($.prev, $.next),
      l(s.flagged(), s.hidden()),
      l(s.hidden(), s.flagged()),
      l(s.revealed(), s.revealed()),
    ),
  },
  _set_revealed: {
    rule__params: l($.next, $.prev, l($.x, $.y)),
    rule__body: s._updated_at(
      $.next,
      $.prev,
      $.x,
      $.y,
      fn(s.tile(s.revealed(), $.content), s.tile(__, $.content))(),
    ),
  },
  _on_reveal: {
    rule__params: l($.next, $.state, $.x, $.y),
    rule__body: seq(
      s._state_at($.tile, $.state, l($.x, $.y)),
      u(s.tile(s.hidden(), $.content), $.tile),
      s.if_then_else(
        u($.content, s.empty()),
        s._reveal_neighbors($.next, $.state, l(l($.x, $.y))),
        s._set_revealed($.next, $.state, l($.x, $.y)),
      ),
    ),
  },
  _reveal_neighbors_: {
    rule__params: l($.next, $.prev, $.h, $.t),
    rule__body: seq(
      s.collect_item_in(
        $.ns,
        l($.n, $.content),
        seq(
          s._neighbor($.n, $.h),
          s._state_at(s.tile(s.hidden(), $.content), $.prev, $.n),
          s.none(s.has($.n, $.t)),
        ),
      ),
      s.if_then_else(
        s.has(l(__, s.bomb()), $.ns),
        s._reveal_neighbors($.next, $.prev, $.t),
        s._reveal_neighbors(
          $.next,
          $.prev,
          x.append($.t, x.map_list($.ns, fn($.n, l($.n, __))())),
        ),
      ),
    ),
  },
  _reveal_neighbors: {
    rule__params: l($.next, $.prev, $.list),
    rule__body: s.if_then_else(
      s.empty($.list),
      u($.next, $.prev),
      seq(
        s.append($.list, l($.h), $.t),
        s._set_revealed($.inter, $.prev, $.h),
        s._reveal_neighbors_($.next, $.inter, $.h, $.t),
      ),
    ),
  },
  _on_click: {
    rule__params: l($.event, $.id),
    rule__body: seq(
      s._state($.state, $.id),
      s._game_win(s.pending(), $.state),
      s.match_cond(
        $.event,
        l(
          s.flag($.x, $.y),
          seq(
            s._updated_at($.next, $.state, $.x, $.y, s._on_flag()),
            s.db__update(s.update(s._state($.next, $.id))),
          ),
        ),
        l(
          s.reveal($.x, $.y),
          seq(
            s._on_reveal($.next, $.state, $.x, $.y),
            s.db__update(s.update(s._state($.next, $.id))),
          ),
        ),
      ),
    ),
  },
});
