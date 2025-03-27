import { l, s, $, __, u, seq, x, xfn, alt } from "../expr";
import { pkg } from "../pkg";

export const { rules: match3Rules } = pkg("match_3", {
  _game: {
    db__schema: "schema",
    file__name: "Match 3 Game",
    schema__fields: l(s.field("_state"), s.field("time__created")),
  },
  _state: {
    db__schema: "field",
    file__name: "Game state",
    field__type: s.list_of(s.list_of(s.number())),
  },
  _icon_tile: {
    rule__params: l($.icon, $.tile),
    rule__body: s.match(
      l($.icon, $.tile),
      l("🐙", 0),
      l("🪼", 1),
      l("🐡", 2),
      l("🦭", 3),
      l("🐊", 4),
      l("🐬", 5),
      l("🦀", 6),
    ),
  },
  _random_int: {
    rule__params: l($.rand, $.max),
    rule__body: s.floor($.rand, x.mul(x.add(1, $.max), x.random())),
  },
  _random_list: {
    rule__params: l($.list, $.len),
    rule__body: s.collect_item_in(
      $.list,
      $.tile,
      seq(s.number_min_max(__, 0, $.len), s._random_int($.tile, 6)),
    ),
  },
  _random_state: {
    rule__params: l($.state),
    rule__body: s.collect_item_in(
      $.state,
      $.col,
      seq(s.number_min_max(__, 0, 7), s._random_list($.col, 7)),
    ),
  },

  _new_game: {
    file__name: "New Game",
    schema__constructor: "_game",
    rule__params: l($.id),
    rule__body: seq(
      s.or_default($.id, x.id()),
      s.timestamp($.ts),
      s._random_state($.state),
      s.db__update(s.insert(s._game($.id, $.state, $.ts))),
    ),
  },
  _find_matches: {
    rule__params: l($.matches, $.state),
    rule__body: seq(
      s.index_value_box($.x, $.col, $.state),
      s.index_value_box($.y, $.tile, $.col),
      u($.center, s.tile($.x, $.y)),
      s._check_neighbors($.matches, l($.center), $.center, $.state, $.tile),
      s.gt_eq(x.length($.matches), 3),
    ),
  },
  _matching_neighbors: {
    rule__params: l($.neighbor, $.state, $.tile, $.target, $.visited),
    rule__body: seq(
      s._adjacent($.neighbor, $.target),
      s.none(s.in($.neighbor, $.visited)),
      u(s.tile($.nx, $.ny), $.neighbor),
      s._at_grid($.tile, $.state, $.nx, $.ny),
    ),
  },
  _check_neighbors: {
    rule__params: l($.matches, $.visited, $.target, $.state, $.tile),
    rule__body: seq(
      s.list($.ns, x._matching_neighbors($.state, $.tile, $.target, $.visited)),
      s.append($.next_visited, $.visited, $.ns),
      s.ensure_det(
        s.fold_list(
          $.matches,
          $.next_visited,
          $.ns,
          s._check_neighbors($.state, $.tile),
        ),
      ),
    ),
  },
  _clear_marked: {
    rule__params: l($.cleared, $.state, $.matches),
    rule__body: seq(
      s.collect_item_in(
        $.cleared,
        $.next_col,
        seq(
          s.index_value_box($.x, $.col, $.state),
          s.collect_item_in(
            $.next_col,
            $.tile,
            seq(
              s.index_value_box($.y, $.tile, $.col),
              s.none(s.in(s.tile($.x, $.y), $.matches)),
            ),
          ),
        ),
      ),
    ),
  },
  _refill_columns: {
    rule__params: l($.refilled, $.state, $.len),
    rule__body: seq(
      s.collect_item_in(
        $.refilled,
        $.next_col,
        seq(
          s.in($.col, $.state),
          s._random_list($.rand, x.sub($.len, x.length($.col))),
          s.append($.next_col, $.rand, $.col),
        ),
      ),
    ),
  },

  _clear_match: {
    rule__params: l($.after, $.before),
    file__description: l(
      "clear match and fill in new random tiles from above; fail if no match",
    ),
    rule__body: seq(
      s.limit(1, s._find_matches($.matches, $.before)),
      s._clear_marked($.cleared, $.before, $.matches),
      s._refill_columns($.after, $.cleared, 7),
    ),
  },
  _adjacent: {
    rule__params: l(s.tile($.x0, $.y0), s.tile($.x1, $.y1)),
    rule__body: alt(
      seq(s.inc($.x0, $.x1), u($.y0, $.y1)),
      seq(s.dec($.x0, $.x1), u($.y0, $.y1)),
      seq(s.inc($.y0, $.y1), u($.x0, $.x1)),
      seq(s.dec($.y0, $.y1), u($.x0, $.x1)),
    ),
  },
  _at_grid: {
    rule__params: l($.value, $.state, $.x, $.y),
    rule__body: seq(s.at($.col, $.state, $.x), s.at($.value, $.col, $.y)),
  },
  _swap: {
    rule__params: l($.b, $.a, s.tile($.x0, $.y0), s.tile($.x1, $.y1)),
    rule__body: seq(
      s.updated_box_index_fn(
        $.a1,
        $.a,
        $.x0,
        s.updated_box_index_value($.y0, x._at_grid($.a, $.x1, $.y1)),
      ),
      s.updated_box_index_fn(
        $.b,
        $.a1,
        $.x1,
        s.updated_box_index_value($.y1, x._at_grid($.a, $.x0, $.y0)),
      ),
    ),
  },
  _update_state: {
    rule__params: l($.id, $.next_state),
    // TODO: update undo history
    rule__body: s.db__update(s.update(s._state($.next_state, $.id))),
  },
  _try_swap: {
    rule__params: l($.id, $.from, $.to),
    rule__body: seq(
      s._state($.state, $.id),
      s._adjacent($.from, $.to),
      s._swap($.swapped, $.state, $.from, $.to),
      s._clear_match($.cleared, $.swapped),
      s._update_state($.id, $.cleared),
      s._clear_cascade($.id),
    ),
  },
  _clear_cascade: {
    rule__params: l($.id),
    rule__body: s.loop(
      seq(
        s.sleep(300),
        s._state($.state, $.id),
        s._clear_match($.cleared, $.state),
        s._update_state($.id, $.cleared),
      ),
    ),
  },
  _on_change: {
    rule__params: l($.tile, $.id, $.params),
    rule__body: seq(
      s.get_state($.selected, $.params, s.none()),
      s.match_cond(
        $.selected,
        l(s.none(), s.set_state($.params, $.tile)),
        l(
          $.from,
          seq(
            s.set_state($.params, s.none()),
            s._try_swap($.id, $.from, $.tile),
          ),
        ),
      ),
    ),
  },
  _view_board: {
    rule__params: l($.out, $.state, $.selected, $.on_change),
    rule__body: s.row(
      $.out,
      l(),
      xfn($.o)(
        s.index_value_box($.x, $.col, $.state),
        s.column(
          $.o,
          l(),
          xfn($.o1)(
            s.index_value_box($.y, $.tile, $.col),
            s._icon_tile($.icon, $.tile),
            s.view__button(
              $.o1,
              x.list(
                s.style("fontSize", "3rem"),
                xfn($.style)(
                  s.if_then_else(
                    u($.selected, s.tile($.x, $.y)),
                    u($.style, s.style("borderColor", "black")),
                    u($.style, s.style("borderColor", "white")),
                  ),
                ),
              ),
              $.icon,
              s.on_click(s.call($.on_change, s.tile($.x, $.y))),
            ),
          ),
        ),
      ),
    ),
  },
  _view_game: {
    db__schema: "view",
    view__subject: s.schema("_game"),
    rule__params: l($.out, $.id, $.params),
    file__name: "Match 3",
    rule__body: seq(
      s._view_board(
        $.out,
        x._state($.id),
        x.get_state($.params, s.none()),
        s._on_change($.id, $.params),
      ),
    ),
  },
});
