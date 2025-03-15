import { Rec } from ".";
import { l, s, $, seq, u, __, alt, f, fn } from "../expr";
import { pkg } from "../pkg";

export const browserData = pkg("browser", {
  // schemas
  window: {
    db__schema: "schema",
    file__name: "Window",
    file__description: l("A window"),
    schema__fields: l(s.field("_current_history")),
  },
  history: {
    db__schema: "schema",
    file__name: "History",
    file__description: l("A history entry"),
    schema__fields: l(
      s.field("_window"),
      s.field("_id"),
      s.field_optional("_view"),
      s.field_optional("_params"),
      s.field_optional("_focus"),
      s.field("_forward"),
      s.field("_back"),
    ),
  },

  // fields

  view__menu_items: {
    db__schema: "field",
    file__name: "View menu items",
  },
  _id: {
    db__schema: "field",
    file__name: "History id ref",
    field__type: "ref",
  },
  _view: {
    db__schema: "field",
    file__name: "History view ref",
    field__type: "ref",
  },
  _params: {
    db__schema: "field",
    file__name: "History view params",
  },
  _focus: {
    db__schema: "field",
    file__name: "History focused element",
  },
  _back: {
    db__schema: "field",
    file__name: "History back ref",
    field__type: "ref",
    // field__type: s.ref( "history" as const),
  },
  _forward: {
    db__schema: "field",
    file__name: "History forward ref",
    field__type: "ref",
    // field__type: s.ref( "history" as const),
  },
  _window: {
    db__schema: "field",
    file__name: "History window ref",
    field__type: "ref",
    // field__type: s.ref( "window"),
  },
  _current_history: {
    db__schema: "field",
    file__name: "Window current history ref",
    field__type: "ref",
    // field__type: s.ref( "history" as const),
  },
  _current_window: {
    db__schema: "field",
    file__name: "Focused window in browser",
    field__type: "ref",
    // field__type: s.ref( "window" ),
  },

  location: {
    db__schema: "type",
    file__name: "location",
    file__description: l(
      "A location is a what a link points to. It is a box containing the record ID, with an optional view ID and parameters",
    ),
    rule__params: l($.item),
    rule__body: s.location_id_view_params($.item, __, __, __),
  },
  location_id_view_params: {
    file__description: l("destruct a location into its constituent parts"),
    rule__params: l($.location, $.id, $.view, $.params),
    rule__body: seq(
      s.nonvar($.location),
      s.match(
        $.location,
        s.location($.id),
        s.location($.id, $.view),
        s.location($.id, $.view, $.params),
      ),
      s.var_expr($.params, s.unify(l())),
    ),
  },

  current_window: {
    rule__params: l($.window),
    rule__body: f._current_window("browser", $.window),
  },
  current_focus: {
    rule__params: l($.focus),
    rule__body: seq(
      f._current_window("browser", $.window),
      f._current_history($.window, $.history),
      f._focus($.history, $.focus),
    ),
  },
  _render_root: {
    rule__params: l(),
    rule__body: s.send("root_view_manager", s.render()),
  },

  boot: {
    rule__params: l($.pid),
    rule__body: seq(
      s.init__db_server(),
      s.init_debugger(),
      s.spawn_link(
        $.pid,
        // loop because we want this process to stay mounted
        s.loop(s._subscribe_render(s.record("browser"), s._desktop())),
      ),
    ),
  },
  get_state: {
    rule__params: l($.value, $.state, $.default),
    rule__body: s.value_record_field_default(
      $.value,
      $.state,
      "_params",
      $.default,
    ),
  },
  set_state: {
    rule__params: l($.state, $.value),
    rule__body: s.db__update(l(s.update($.state, "_params", $.value))),
  },
  get_focus: {
    rule__params: l($.value, $.state, $.default),
    rule__body: s.value_record_field_default(
      $.value,
      $.state,
      "_focus",
      $.default,
    ),
  },
  set_focus: {
    rule__params: l($.state, $.value),
    rule__body: s.db__update(l(s.update($.state, "_focus", $.value))),
  },

  // event handlers
  on__set_view_menu: {
    rule__params: l($.window, $.next_view),
    rule__body: seq(
      f._current_history($.window, $.history),
      s.db__update(l(s.update($.history, "_view", $.next_view))),
    ),
  },
  on__select_window: {
    rule__params: l($.window),
    rule__body: seq(
      s.db__update(l(s.update("browser", "_current_window", $.window))),
    ),
  },
  on__new_window: {
    rule__params: l($.location),
    rule__body: seq(
      s._new_window($.out, __, $.location),
      s.db__update($.out),
      s._render_root(),
    ),
  },
  on__close_window: {
    rule__params: l($.window),
    rule__body: seq(s.db__update(l(s.delete($.window))), s._render_root()),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: seq(
      f._current_history($.window, $.prev),
      s._new_history($.h, $.next, $.window, $.location),
      s.append_left_right(
        $.batch,
        $.h,
        l(
          s.update($.next, "_back", $.prev),
          s.update($.prev, "_forward", $.next),
          s.update($.window, "_current_history", $.next),
        ),
      ),
      s.db__update($.batch),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: seq(
      f._current_history($.window, $.forward),
      f._back($.forward, $.back),
      s.db__update(
        l(
          s.update($.window, "_current_history", $.back),
          s.update($.back, "_forward", $.forward),
          s.delete($.forward, "_back"),
        ),
      ),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: seq(
      f._current_history($.window, $.back),
      f._forward($.back, $.forward),
      s.db__update(
        l(
          s.update($.window, "_current_history", $.forward),
          s.update($.forward, "_back", $.back),
          s.delete($.back, "_forward"),
        ),
      ),
    ),
  },
  view__subscribe_render: {
    rule__params: l($.out, $.subscriptions, $.render),
    rule__body: seq(
      u($.out, s.Receiver(s._subscribe_render($.subscriptions, $.render))),
    ),
  },
  _subscribe_render: {
    rule__params: l($.subscriptions, $.render),
    rule__body: seq(
      s.trap_exit(),
      s.self($.self),
      s.receive(s.mount($.view)),
      s.send($.self, s.render()),
      s.db__subscribe_callback(
        $.sub,
        $.subscriptions,
        s.send($.self, s.render()),
      ),
      s.loop(
        seq(
          s.receive($.e),
          s.match_cond(
            $.e,
            l(
              s.render(),
              seq(
                s.if_then_else(
                  s.apply(l($.render_out), $.render),
                  s.send($.view, $.render_out),
                  // TODO: should something else happen when render fails?
                  s.send($.view, s.Null()),
                ),
              ),
            ),
            l(s.unmount(), seq(s.db__unsubscribe($.sub), s.fail())),
            l(
              s.exit($.p, $.reason),
              s.cond(
                u($.reason, s.normal()),
                seq(
                  s.log("error", $.p, $.reason),
                  // s.debugger(),
                  // s.send($.self, s.render()),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },

  // views
  _desktop: {
    rule__params: l($.out),
    rule__body: s.html(
      $.out,
      "div",
      l(),
      s.view__subscribe_render(s.record("browser"), s._app_menu()),
      s.expr_iter(
        seq(
          s.record_field_value($.window, "db__schema", "window"),
          f._current_history($.window, $.history),
        ),
        s.view__subscribe_render(
          s.oneof(l(s.record($.window), s.record($.history))),
          s._view_window($.window),
        ),
      ),
    ),
  },
  _view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.out, $.window, $.id, $.selected),
    rule__body: seq(
      s.collect_item_in(
        $.options,
        s.option($.view, $.name),
        seq(
          s.schema__views($.view, $.id),
          s.cond(f.file__name($.view, $.name), u($.view, $.name)),
        ),
      ),
      s.view__select(
        $.out,
        l(),
        $.selected,
        $.options,
        fn(s.change($.next_view))(s.on__set_view_menu($.window, $.next_view)),
      ),
    ),
  },

  _window_container: {
    rule__params: l(
      s.WindowContainer(
        $.window,
        $.current_window,
        s.match_cond(
          l(s.select_window(), s.on__select_window($.window)),
          l(s.back(), s.on__back($.window)),
          l(s.forward(), s.on__forward($.window)),
        ),
        $.rendered_children,
      ),
      $.window,
      $.current_window,
      $.children,
    ),
    rule__body: s.expr_children($.rendered_children, $.children),
  },

  _window_content: {
    rule__params: l($.out, $.view, $.id, $.window, $.history),
    rule__body: s.call($.view, $.out, $.id, $.history),
  },

  _window_params: {
    rule__params: l($.id, $.view, $.history, $.window),
    rule__body: seq(
      f._current_history($.window, $.history),
      f._id($.history, $.id),
      s.cond(
        f._view($.history, $.view),
        s.limit(1, s.schema__views($.view, $.id)),
      ),
    ),
  },

  _view_window: {
    file__name: "Window",
    rule__params: l($.out, $.window),
    rule__body: seq(
      s._window_params($.id, $.view, $.history, $.window),
      f._current_window("browser", $.current_window),
      s.cond(f.file__name($.id, $.name), u($.name, $.id)),

      s.try_error_trace_catch(
        seq(
          s._window_container(
            $.out,
            $.window,
            $.current_window,
            l(
              s._window_bar($.window, $.id, $.view, $.name),
              s.html(
                "div",
                l(s.class("AppWindow__content")),
                s.view__subscribe_render(
                  s.oneof(
                    l(s.record($.history), s.record($.id), s.record($.view)),
                  ),
                  s._window_content($.view, $.id, $.window, $.history),
                ),
              ),
            ),
          ),
        ),
        $.error,
        $.trace,
        seq(
          s.log("error", $.error, $.trace),
          s._window_container(
            $.out,
            $.window,
            $.current_window,
            l(
              s._window_bar($.window, $.id, $.view, "Home"),
              s.html(
                "div",
                l(s.class("AppWindow__content")),
                s.view__string("Error, see console for details"),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _window_bar: {
    rule__params: l($.out, $.window, $.id, $.view, $.name),
    rule__body: seq(
      f._current_history($.window, $.history),
      s.if_then_else(
        f._back($.history, __),
        u($.back_class, "AppWindow__nav"),
        u($.back_class, "AppWindow__nav AppWindow__nav--disabled"),
      ),
      s.if_then_else(
        f._forward($.history, __),
        u($.forward_class, "AppWindow__nav"),
        u($.forward_class, "AppWindow__nav AppWindow__nav--disabled"),
      ),
      s.row(
        $.out,
        l(s.class("AppWindow__header")),
        s.view__button(
          l(s.class("AppWindow__closeButton")),
          "",
          s.on_click(s.on__close_window($.window)),
        ),
        s.html("h1", l(s.class("AppWindow__title")), s.view__string($.name)),

        s.html("div", l(s.style("flex", "1 0 auto"))),
        s.view__button(
          l(s.class($.back_class)),
          "←",
          s.on_click(s.on__back($.window)),
        ),
        s.view__button(
          l(s.class($.forward_class)),
          "→",
          s.on_click(s.on__forward($.window)),
        ),
        s._view_menu($.window, $.id, $.view),
      ),
    ),
  },
  _bind_window_menu: {
    rule__params: l($.bound, $.unbound, $.id, $.state),
    rule__body: s.map_list(
      $.bound,
      $.unbound,
      fn(
        s.menu($.menu_label, $.bound_options),
        s.menu($.menu_label, $.options),
      )(
        s.map_list(
          $.bound_options,
          $.options,
          fn(
            s.menu_option($.opt_id, $.opt_label, s.call($.fn, $.id, $.state)),
            s.menu_option($.opt_id, $.opt_label, $.fn),
          )(),
        ),
      ),
    ),
  },
  _app_menu_content: {
    rule__params: l(
      l(
        s.menu(
          "Menu",
          l(
            s.menu_option("home", "Home", s.on__new_window(s.location("home"))),
            s.menu_option(
              "search",
              "Search",
              s.on__new_window(s.location("omnibox")),
            ),
            s.menu_option("reset", "Reset", s.db__reset()),
          ),
        ),
      ),
    ),
  },
  _app_menu: {
    file__name: "App menu",
    rule__params: l($.out),
    rule__body: seq(
      s.current_window($.window),
      s.cond(
        seq(
          s._window_params($.id, $.view, $.history, $.window),
          f.view__menu_items($.view, $.window_menu_base),
          s._bind_window_menu(
            $.window_menu,
            $.window_menu_base,
            $.id,
            $.history,
          ),
        ),
        u($.window_menu, l()),
      ),
      s._app_menu_content($.base_menu),
      s.append_left_right($.menu_bar, $.base_menu, $.window_menu),

      s.row(
        $.out,
        l(
          s.style("backgroundColor", "white"),
          s.style("borderBottom", "1px solid black"),
        ),
        s.expr_iter(
          seq(
            s(s.menu($.title, $.menu)).in($.menu_bar),
            s.collect_item_in(
              $.options,
              s.option($.opt_id, $.label),
              s(s.menu_option($.opt_id, $.label, __)).in($.menu),
            ),
          ),
          s.view__menu(
            l(s.class("AppMenu")),
            $.title,
            $.options,
            fn(s.change($.opt_id))(
              s(s.menu_option($.opt_id, __, $.handler)).in($.menu),
              $.handler,
            ),
          ),
        ),
      ),
    ),
  },

  _new_window: {
    rule__params: l($.out, $.window, $.location),
    rule__body: seq(
      s.var_expr($.window, s.id()),
      s._new_history($.h, $.history, $.window, $.location),
      s.append_left_right(
        $.out,
        $.h,
        l(
          s.update($.window, "db__schema", "window"),
          s.update($.window, "_current_history", $.history),
          s.update("browser", "_current_window", $.window),
        ),
      ),
    ),
  },
  _new_history: {
    rule__params: l($.out, $.history, $.window, $.location),
    rule__body: seq(
      s.var_expr($.history, s.id()),
      s.timestamp($.ts),
      s.location_id_view_params($.location, $.id, $.view, $.params),

      s.collect_item_in(
        $.out,
        s.update($.history, $.f, $.v),
        alt(
          u(l($.f, $.v), l("db__schema", "history")),
          u(l($.f, $.v), l("time__created", $.ts)),
          u(l($.f, $.v), l("_window", $.window)),
          u(l($.f, $.v), l("_id", $.id)),
          seq(s.nonvar($.view), u(l($.f, $.v), l("_view", $.view))),
          seq(s.nonvar($.params), u(l($.f, $.v), l("_params", $.params))),
        ),
      ),
    ),
  },
});

export const browserInitState = {
  root_history: {
    db__schema: "history",
    browser__window: "root_window",
    browser__id: "home",
  },
  root_window: {
    db__schema: "window",
    browser__current_history: "root_history",
  },
  browser: {
    file__name: "Browser state",
    browser__current_window: "root_window",
  },
} satisfies Record<string, Rec>;
