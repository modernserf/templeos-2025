import { l, s, $, seq, u, __, alt, fn, x, xfn } from "../expr";
import { pkg } from "../pkg";

export const { rules: browserData } = pkg("browser", {
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
      s.field_optional("_forward"),
      s.field_optional("_back"),
    ),
  },

  // fields

  _id: {
    db__schema: "field",
    file__name: "History id ref",
    field__type: s.ref(__), // the type here unifies with view
  },
  _view: {
    db__schema: "field",
    file__name: "History view ref",
    field__type: s.ref("view"), // TODO: view schema
  },
  _params: {
    db__schema: "field",
    file__name: "History view params",
    field__type: s.any_type(), // TODO: view schema defines params type, this references that value
  },
  _focus: {
    db__schema: "field",
    file__name: "History focused element",
    field__type: s.any_type(), // TODO: ditto view schema referernce
  },
  _back: {
    db__schema: "field",
    file__name: "History back ref",
    field__type: s.ref("history"),
  },
  _forward: {
    db__schema: "field",
    file__name: "History forward ref",
    field__type: s.ref("history"),
  },
  _window: {
    db__schema: "field",
    file__name: "History window ref",
    field__type: s.ref("window"),
  },
  _current_history: {
    db__schema: "field",
    file__name: "Window current history ref",
    field__type: s.ref("history"),
  },
  _current_window: {
    db__schema: "field",
    file__name: "Focused window in browser",
    field__type: s.ref("window"),
  },

  location: {
    file__name: "location",
    file__description: l(
      "A location is a what a link points to. It is a box containing the record ID, with an optional view ID and parameters",
    ),
    rule__params: l($.t),
    rule__body: s.enum(
      $.t,
      s.location(s.ref(__)),
      s.location(s.ref(__), s.ref(__)),
      s.location(s.ref(__), s.ref(__), s.type__any()),
    ),
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
    ),
  },

  current_window: {
    rule__params: l($.window),
    rule__body: s._current_window($.window, "browser"),
  },
  current_focus: {
    rule__params: l($.focus),
    rule__body: seq(
      s.current_window($.window),
      s._current_history($.history, $.window),
      s._focus($.focus, $.history),
    ),
  },

  boot: {
    rule__params: l($.pid),
    rule__body: seq(
      s.init__db_server(),
      s.init_debugger(),
      s.spawn_link(
        $.pid,
        // loop because we want this process to stay mounted
        s.loop(
          s._subscribe_render(
            s.match(s.update("browser", __, __)),
            seq(s._desktop()),
          ),
        ),
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
      s._current_history($.history, $.window),
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
    rule__body: seq(s._new_window($.out, __, $.location), s.db__update($.out)),
  },
  on__close_window: {
    rule__params: l($.window),
    rule__body: seq(s.db__update(l(s.delete($.window)))),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: seq(
      s._current_history($.prev, $.window),
      s._new_history($.h, $.next, $.window, $.location),
      s.append(
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
      s._current_history($.forward, $.window),
      s._back($.back, $.forward),
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
      s._current_history($.back, $.window),
      s._forward($.forward, $.back),
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
    rule__params: l($.out, $.fn, $.render),
    rule__body: u($.out, s.Receiver(s._subscribe_render($.fn, $.render))),
  },
  _subscribe_render: {
    rule__params: l($.fn, $.render),
    rule__body: seq(
      s.trap_exit(),
      s.self($.self),
      s.receive(s.mount($.view)),
      s.send($.self, s.render()),
      s.db__subscribe(
        $.sub,
        fn($.batch)(
          s.limit(
            1,
            seq(
              s($.row).in($.batch),
              s.call($.fn, $.row),
              s.send($.self, s.render()),
            ),
          ),
        ),
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
      x.view__subscribe_render(
        s.match(
          s.update("browser", "_current_window", __),
          s.update(__, "_view", __),
        ),
        s._app_menu(),
      ),
      xfn($.u)(
        s.db__schema("window", $.window),
        s._current_history($.history, $.window),
        s.view__subscribe_render(
          $.u,
          s.match(
            s.update($.window, __, __),
            s.update($.history, "_view", __),
            s.delete($.window),
            s.update("browser", "_current_window", __),
          ),
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
      s.view__select(
        $.out,
        l(),
        $.selected,
        x.collect_item_in(
          s.option($.view, $.name),
          seq(
            s.view__for_record($.view, $.id),
            s.cond(s.file__name($.name, $.view), u($.view, $.name)),
          ),
        ),
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
        $.children,
      ),
      $.window,
      $.current_window,
      $.children,
    ),
  },

  _window_params: {
    rule__params: l($.id, $.view, $.history, $.window),
    rule__body: seq(
      s._current_history($.history, $.window),
      s._id($.id, $.history),
      s.cond(
        s._view($.view, $.history),
        s.limit(1, s.view__for_record($.view, $.id)),
      ),
    ),
  },

  _view_window: {
    file__name: "Window",
    rule__params: l($.out, $.window),
    rule__body: seq(
      s._window_params($.id, $.view, $.history, $.window),
      s.current_window($.current_window),
      s.cond(s.file__name($.name, $.id), u($.name, $.id)),

      s.try_error_trace_catch(
        seq(
          s._window_container(
            $.out,
            $.window,
            $.current_window,
            x.list(
              x._window_bar($.window, $.id, $.view, $.name),
              x.html(
                "div",
                l(s.class("AppWindow__content")),
                x.view__subscribe_render(
                  s.match(
                    s.update($.history, __, __),
                    s.update($.id, __, __),
                    s.update(__, __, $.id),
                  ),
                  s.view__render($.view, $.id, $.history),
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
            x.list(
              x._window_bar($.window, $.id, $.view, "Home"),
              x.html(
                "div",
                l(s.class("AppWindow__content")),
                "Error, see console for details",
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
      s._current_history($.history, $.window),
      s.row(
        $.out,
        l(s.class("AppWindow__header")),
        x.view__button(
          l(s.class("AppWindow__closeButton")),
          "",
          s.on_click(s.on__close_window($.window)),
        ),
        x.html("h1", l(s.class("AppWindow__title")), $.name),

        x.html("div", l(s.style("flex", "1 0 auto"))),
        x.view__button(
          x.list(
            s.class("AppWindow__nav"),
            xfn($.o)(
              s._back(__, $.history),
              u($.o, s.class("AppWindow__nav--enabled")),
            ),
          ),
          "←",
          s.on_click(s.on__back($.window)),
        ),
        x.view__button(
          x.list(
            s.class("AppWindow__nav"),
            xfn($.o)(
              s._forward(__, $.history),
              u($.o, s.class("AppWindow__nav--enabled")),
            ),
          ),
          "→",
          s.on_click(s.on__forward($.window)),
        ),
        x._view_menu($.window, $.id, $.view),
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
          s.view__menu_items($.window_menu_base, $.view),
          s._bind_window_menu(
            $.window_menu,
            $.window_menu_base,
            $.id,
            $.history,
          ),
        ),
        u($.window_menu, l()),
      ),
      s.append($.menu_bar, x._app_menu_content(), $.window_menu),

      s.row(
        $.out,
        l(
          s.style("backgroundColor", "white"),
          s.style("borderBottom", "1px solid black"),
        ),
        xfn($.out)(
          s(s.menu($.title, $.menu)).in($.menu_bar),
          s.view__menu(
            $.out,
            l(s.class("AppMenu")),
            $.title,
            x.collect_item_in(
              s.option($.opt_id, $.label),
              s(s.menu_option($.opt_id, $.label, __)).in($.menu),
            ),
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
      s.or_default($.window, x.id()),
      s._new_history($.h, $.history, $.window, $.location),
      s.append(
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
      s.or_default($.history, x.id()),
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

export const { rules: browserInitState } = pkg("browser", {
  root_history: {
    db__schema: "history",
    _window: "root_window",
    _id: "home",
  },
  root_window: {
    db__schema: "window",
    _current_history: "root_history",
  },
  browser: {
    file__name: "Browser state",
    _current_window: "root_window",
  },
});
