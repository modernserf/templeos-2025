import { l, s, $, __, seq } from "../expr";
import { pkg } from "../pkg";

export const debug = pkg("debug", {
  init_debugger: {
    rule__params: l(),
    rule__body: s.spawn_link("debugger", s._init()),
  },
  debugger: {
    rule__params: l(),
    rule__body: seq(
      s.self($.self),
      s.id($.ref),
      s.send("debugger", s.break($.self, $.ref)),
      s.receive(s.resume($.ref)),
    ),
  },
  _init: {
    rule__params: l(),
    rule__body: s.loop(
      seq(
        s.receive($.e),
        s.match_cond(
          $.e,
          l(
            s.break($.pid, $.ref),
            s.on__new_window(
              s.location(
                "view__debugger",
                "view__debugger",
                s.debugger($.pid, $.ref),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _resume: {
    rule__params: l($.pid, $.ref),
    rule__body: s.send($.pid, s.resume($.ref)),
  },
  view__debugger: {
    db__schema: "form",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.current_window($.window),
      s.get_state(s.debugger($.pid, $.ref), $.state, s.none()),
      s.column(
        $.out,
        l(s.style("padding", "1rem")),
        s.view__button(
          l(),
          "Resume",
          s.on_click(
            seq(s._resume($.pid, $.ref), s.on__close_window($.window)),
          ),
        ),
      ),
    ),
  },
});
