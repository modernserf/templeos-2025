import { l, s, $, __, seq, u, fn } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const supervisor = pkg("supervisor", {
  supervisor: {
    rule__params: l($.pid, $.config, $.workers),
    rule__body: seq(s.spawn_link($.pid, s._init($.config, $.workers))),
  },
  _init: {
    rule__params: l($.sup_config, $.workers),
    rule__body: seq(
      s.trap_exit(),
      s.self($.supervisor),
      s.map_list(
        $.init,
        $.workers,
        fn(l($.pid, $.cfg), $.cfg)(s._init_worker($.pid, $.cfg)),
      ),

      s.loop_iter(
        $.next,
        $.prev,
        $.init,
        seq(
          s.receive($.e),
          s.match_cond(
            $.e,
            l(
              s.workers($.to, $.ref),
              seq(s.send($.to, s.workers($.ref, $.prev)), u($.next, $.prev)),
            ),
            l(
              s.exit($.pid, $.reason),
              seq(
                s.ensure_det(
                  s._worker_exit($.next, $.prev, $.pid, $.reason, $.sup_config),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _workers: {
    rule__params: l($.workers, $.supervisor),
    rule__body: seq(
      s.self($.self),
      s.id($.ref),
      s.send($.supervisor, s.workers($.self, $.ref)),
      s.receive(s.workers($.ref, $.workers)),
    ),
  },

  _init_worker: {
    rule__params: l($.pid, s.worker(__, $.goal)),
    rule__body: s.spawn_link($.pid, $.goal),
  },
  _worker_exit: {
    rule__params: l($.next, $.prev, $.pid, $.reason, s.supervisor($.strategy)),
    rule__body: seq(
      s.value_box_index(l($.pid, s.worker($.restart, __)), $.prev, $.i),
      s.match_cond(
        l($.restart, $.reason, $.strategy),
        // no restart
        l(
          l(s.temporary(), __, __),
          s.updated_box_index_removed($.next, $.prev, $.i, l(__)),
        ),
        l(
          l(s.transient(), s.normal(), __),
          s.updated_box_index_removed($.next, $.prev, $.i, l(__)),
        ),
        // restart
        l(l(__, __, s.one_for_one()), s._restart_one($.next, $.prev, $.i)),
        l(l(__, __, s.one_for_all()), s._restart_all($.next, $.prev)),
        l(l(__, __, s.one_for_all()), s._restart_rest($.next, $.prev, $.i)),
      ),
    ),
  },
  _restart_one: {
    rule__params: l($.next, $.prev, $.i),
    rule__body: seq(
      s.value_box_index(l($.old_pid, $.worker), $.prev, $.i),
      s._init_worker($.new_pid, $.worker),
      s.updated_box_index_value($.next, $.prev, $.i, l($.new_pid, $.worker)),
    ),
  },
  _restart_all: {
    rule__params: l($.next, $.prev),
    rule__body: s.collect_item_in(
      $.next,
      l($.pid, $.worker),
      seq(
        s.value_box_index(l($.old_pid, $.worker), $.prev, __),
        s.exit($.old_pid, s.restart_all()),
        s.receive(s.exit($.old_pid, s.restart_all())),
        s._init_worker($.pid, $.worker),
      ),
    ),
  },
  _restart_rest: {
    rule__params: l($.next, $.prev, $.i),
    rule__body: seq(
      s.left_right_box_split($.left, $.right, $.prev, $.i),
      s._restart_all($.right_restarted, $.right),
      s.append_left_right($.next, $.left, $.right_restarted),
    ),
  },

  _test_worker: {
    rule__params: l($.name, $.agent),
    rule__body: seq(
      seq(
        s.agent_push($.agent, s.init($.name)),
        s.loop(
          seq(
            s.receive($.pat),
            s.match_cond(
              $.pat,
              l(s.continue(), s.agent_push($.agent, s.continue($.name))),
              l(s.stop(), s.fail()),
              l(s.error(), s.throw(s.error($.name))),
            ),
          ),
        ),
        s.agent_push($.agent, s.exit($.name)),
      ),
    ),
  },
  _test_broadcast: {
    rule__params: l($.supervisor, $.message),
    rule__body: seq(
      s._workers($.workers, $.supervisor),
      s.each_item_do($.workers, l($.w, __), seq(s.send($.w, $.message))),
      s.sleep(1),
    ),
  },
  _test: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l()),
      s.supervisor(
        $.supervisor,
        s.supervisor(s.one_for_one()),
        l(
          s.worker(s.temporary(), s._test_worker("foo", $.agent)),
          s.worker(s.transient(), s._test_worker("bar", $.agent)),
          s.worker(s.permanent(), s._test_worker("baz", $.agent)),
        ),
      ),
      test.collect(
        $.res,
        s.agent_get($.res, $.agent),
        l(s.init("foo"), s.init("bar"), s.init("baz")),
      ),
      s.agent_set($.agent, l()),

      s._test_broadcast($.supervisor, s.continue()),
      test.collect(
        $.res,
        s.agent_get($.res, $.agent),
        l(s.continue("foo"), s.continue("bar"), s.continue("baz")),
      ),
      s.agent_set($.agent, l()),

      s._test_broadcast($.supervisor, s.error()),
      test.collect(
        $.res,
        s.agent_get($.res, $.agent),
        l(s.init("bar"), s.init("baz")),
      ),
      s.agent_set($.agent, l()),

      s._test_broadcast($.supervisor, s.stop()),
      test.collect(
        $.res,
        s.agent_get($.res, $.agent),
        l(s.exit("bar"), s.exit("baz"), s.init("baz")),
      ),
    ),
  },
});
