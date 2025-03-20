import { test } from "../data/test_utils";
import { $, l, s, seq, __ } from "../expr";
import { box, k } from "../value";
import { ensure, ensurePid, resolveDeep } from "../process";
import { pkg_ } from "../pkg";

export const { rules: processRules, rulePrimitives: procesPrimitives } = pkg_(
  "process",
  {
    self: {
      rule__params: l($.pid),
      rule__primitive: function* (it, pid) {
        if (it.unify(pid, k(it.pid))) yield it.result();
      },
    },
    send: {
      rule__params: l($.pid, $.message),
      rule__primitive: function* (it, pid, message) {
        ensurePid(pid);
        it.pm.send(pid.value, resolveDeep(message));
        yield it.result();
      },
    },
    receive: {
      rule__params: l($.pattern),
      rule__primitive: function* (it, pattern) {
        const next = yield it.receive(pattern);
        /* v8 ignore next */
        if (!next) throw new Error("expected receive result");
        yield next.result();
      },
    },
    flush: {
      rule__params: l($.messages),
      rule__primitive: function* (it, messages) {
        const ms = it.pm.flush(it.pid);
        if (it.unify(messages, box("", ms))) yield it.result();
      },
    },
    spawn: {
      rule__params: l($.pid, $.goal),
      rule__primitive: function* (it, pid, goal) {
        if (pid.tag === "number" || pid.tag === "string") {
          it.pm.spawn(goal, pid.value);
          yield it.result();
        } else {
          const pidResult = it.pm.spawn(goal);
          if (!it.unify(pid, k(pidResult))) throw new Error("tod");
          yield it.result();
        }
      },
    },
    spawn_link: {
      rule__params: l($.pid, $.goal),
      rule__primitive: function* (it, pid, goal) {
        if (pid.tag === "number" || pid.tag === "string") {
          it.pm.spawn(goal, pid.value, it.pid);
          yield it.result();
        } else {
          const pidResult = it.pm.spawn(goal, undefined, it.pid);
          if (!it.unify(pid, k(pidResult))) throw new Error("tod");
          yield it.result();
        }
      },
    },
    send_async: {
      rule__params: l($.pid, $.message, $.timeout),
      rule__primitive: function* (it, pid, message, timeout) {
        ensure(timeout, "number");
        ensurePid(pid);
        setTimeout(() => {
          it.pm.sendAsync(pid.value, resolveDeep(message));
        }, timeout.value);
        yield it.result();
      },
    },
    link: {
      rule__params: l($.pid),
      rule__primitive: function* (it, pid) {
        ensurePid(pid);
        it.pm.link(it.pid, pid.value);
        yield it.result();
      },
    },
    unlink: {
      rule__params: l($.pid),
      rule__primitive: function* (it, pid) {
        ensurePid(pid);
        it.pm.unlink(it.pid, pid.value);
        yield it.result();
      },
    },
    exit: {
      rule__params: l($.pid, $.reason),
      rule__primitive: function* (it, pid, reason) {
        ensurePid(pid);
        it.pm.exit(it.pid, pid.value, reason);
        yield it.result();
      },
    },
    test__link: {
      test__group: "core",
      rule__params: l(),
      rule__body: seq(
        s.agent($.agent, l(123)),
        s.spawn($.foo, seq(s.receive(__), s.throw(s.fail()))),
        s.spawn(
          $._bar,
          seq(
            s.link($.foo),
            s.agent_push($.agent, 456),
            s.send($.foo, l()),
            // yield to allow linked process to fail
            s.sleep(1),
            s.agent_push($.agent, 789),
          ),
        ),
        s.sleep(10),
        test.collect($.res, s.agent_get($.res, $.agent), l(123, 456)),
      ),
    },
    test__exit: {
      test__group: "core",
      rule__params: l(),
      rule__body: seq(
        s.agent($.agent, l(123)),
        s.spawn(
          $.bar,
          seq(
            s.agent_push($.agent, 456),
            // yield to allow parent process to kill
            s.sleep(1),
            s.agent_push($.agent, 789),
          ),
        ),
        s.exit($.bar, s.kill()),
        test.collect($.res, s.agent_get($.res, $.agent), l(123, 456)),
      ),
    },
    trap_exit: {
      rule__params: l(),
      rule__primitive: function* (it) {
        it.pm.setFlags(it.pid, { trapExit: true });
        yield it.result();
      },
    },
    test__trap_exit: {
      test__group: "core",
      rule__params: l(),
      rule__body: seq(
        s.agent($.agent, l(123)),
        s.spawn($.foo, seq(s.receive(__), s.throw(s.fail()))),
        s.spawn(
          $._bar,
          seq(
            s.trap_exit(),
            s.link($.foo),
            s.agent_push($.agent, 456),
            s.send($.foo, l()),
            // yield to allow linked process to fail
            s.sleep(1),
            s.receive(s.exit($.foo, s.fail())),

            s.agent_push($.agent, 789),
          ),
        ),
        s.sleep(10),
        test.collect($.res, s.agent_get($.res, $.agent), l(123, 456, 789)),
      ),
    },
    active_process: {
      rule__params: l($.pid),
      rule__primitive: function* (it, pid) {
        ensurePid(pid);
        if (it.pm.processes.has(pid.value)) yield it.result();
      },
    },
  },
);
