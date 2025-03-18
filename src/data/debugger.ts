import { l, s, $, __, seq, x } from "../expr";
import { pkg } from "../pkg";

export const debug = pkg("debug", {
  init_debugger: {
    rule__params: l(),
    rule__body: seq(
      s.event_bus("debugger"),
      s.event_subscribe(__, "debugger", s._handle_event()),
    ),
  },
  _handle_event: {
    rule__params: l($.e),
    rule__body: s.match_cond(
      $.e,
      l(
        s.break($.pid, $.ref),
        seq(
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
  },
  debugger: {
    rule__params: l(),
    rule__body: seq(
      s.self($.self),
      s.id($.ref),
      s.event_send("debugger", s.break($.self, $.ref)),
      s.receive(s.resume($.ref)),
    ),
  },
  _resume: {
    rule__params: l($.pid, $.ref),
    rule__body: s.send($.pid, s.resume($.ref)),
  },
  view__debugger: {
    file__name: "Debugger",
    view__subject: s.self(),
    rule__params: l($.out, $._id, $.state),
    rule__body: seq(
      s.current_window($.window),
      s.get_state(s.debugger($.pid, $.ref), $.state, s.none()),
      s.column(
        $.out,
        l(s.style("padding", "1rem")),
        x.view__button(
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
