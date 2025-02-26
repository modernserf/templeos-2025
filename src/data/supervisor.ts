import { Rec } from ".";
import { l, s, $, __, seq, u } from "../expr";
import { test } from "./test_utils";

export const supervisor = {
  supervisor: {
    rule__params: l($.pid, $.config, $.workers),
    rule__body: seq(s.spawn($.pid, s.supervisor__init($.config, $.workers))),
  },
  supervisor__init: {
    rule__params: l($.sup_config, $.workers),
    rule__body: seq(
      s.trap_exit(),
      s.self($.supervisor),
      s.collect_item_in(
        $.init,
        l($.pid, $.worker_config),
        seq(
          s.value_box_index($.worker_config, $.workers, __),
          s.supervisor__init_worker($.pid, $.worker_config),
        ),
      ),

      s.loop_state(
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
              s.supervisor__worker_exit(
                $.next,
                $.prev,
                $.pid,
                $.reason,
                $.sup_config,
              ),
            ),
          ),
        ),
      ),
    ),
  },
  supervisor__workers: {
    rule__params: l($.workers, $.supervisor),
    rule__body: seq(
      s.self($.self),
      s.id($.ref),
      s.send($.supervisor, s.workers($.self, $.ref)),
      s.receive(s.workers($.ref, $.workers)),
    ),
  },

  supervisor__init_worker: {
    rule__params: l($.pid, s.worker(__, $.goal)),
    rule__body: seq(s.spawn($.pid, $.goal), s.link($.pid)),
  },
  supervisor__worker_exit: {
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
        l(
          l(__, __, s.one_for_one()),
          s.supervisor__restart_one($.next, $.prev, $.i),
        ),
        l(
          l(__, __, s.one_for_all()),
          s.supervisor__restart_all($.next, $.prev),
        ),
        l(
          l(__, __, s.one_for_all()),
          s.supervisor__restart_rest($.next, $.prev, $.i),
        ),
      ),
    ),
  },
  supervisor__restart_one: {
    rule__params: l($.next, $.prev, $.i),
    rule__body: seq(
      s.value_box_index(l($.old_pid, $.worker), $.prev, $.i),
      s.supervisor__init_worker($.new_pid, $.worker),
      s.updated_box_index_value($.next, $.prev, $.i, l($.new_pid, $.worker)),
    ),
  },
  supervisor__restart_all: {
    rule__params: l($.next, $.prev),
    rule__body: s.collect_item_in(
      $.next,
      l($.pid, $.worker),
      seq(
        s.value_box_index(l($.old_pid, $.worker), $.prev, __),
        s.exit($.old_pid, s.restart_all()),
        s.receive(s.exit($.old_pid, s.restart_all())),
        s.supervisor__init_worker($.pid, $.worker),
      ),
    ),
  },
  supervisor__restart_rest: {
    rule__params: l($.next, $.prev, $.i),
    rule__body: seq(
      s.left_right_box_split($.left, $.right, $.prev, $.i),
      s.supervisor__restart_all($.right_restarted, $.right),
      s.append_left_right($.next, $.left, $.right_restarted),
    ),
  },

  test__supervisor_worker: {
    rule__params: l($.name, $.agent),
    rule__body: seq(
      seq(
        s.agent__push($.agent, s.init($.name)),
        s.loop(
          seq(
            s.receive($.pat),
            s.match_cond(
              $.pat,
              l(s.continue(), s.agent__push($.agent, s.continue($.name))),
              l(s.stop(), s.fail()),
              l(s.error(), s.throw(s.error($.name))),
            ),
          ),
        ),
        s.agent__push($.agent, s.exit($.name)),
      ),
    ),
  },
  test__supervisor_broadcast: {
    rule__params: l($.supervisor, $.message),
    rule__body: seq(
      s.supervisor__workers($.workers, $.supervisor),
      s.each_item_do($.workers, l($.w, __), seq(s.send($.w, $.message))),
      s.sleep(1),
    ),
  },
  test__supervisor: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l()),
      s.supervisor(
        $.supervisor,
        s.supervisor(s.one_for_one()),
        l(
          s.worker(s.temporary(), s.test__supervisor_worker("foo", $.agent)),
          s.worker(s.transient(), s.test__supervisor_worker("bar", $.agent)),
          s.worker(s.permanent(), s.test__supervisor_worker("baz", $.agent)),
        ),
      ),
      s.link($.supervisor),
      test.collect(
        $.res,
        s.agent__get($.res, $.agent),
        l(s.init("foo"), s.init("bar"), s.init("baz")),
      ),
      s.agent__update($.agent, $.next, __, u($.next, l())),

      s.test__supervisor_broadcast($.supervisor, s.continue()),
      test.collect(
        $.res,
        s.agent__get($.res, $.agent),
        l(s.continue("foo"), s.continue("bar"), s.continue("baz")),
      ),
      s.agent__update($.agent, $.next, __, u($.next, l())),

      s.test__supervisor_broadcast($.supervisor, s.error()),
      test.collect(
        $.res,
        s.agent__get($.res, $.agent),
        l(s.init("bar"), s.init("baz")),
      ),
      s.agent__update($.agent, $.next, __, u($.next, l())),

      s.test__supervisor_broadcast($.supervisor, s.stop()),
      test.collect(
        $.res,
        s.agent__get($.res, $.agent),
        l(s.exit("bar"), s.exit("baz"), s.init("baz")),
      ),
    ),
  },
} satisfies Record<string, Rec>;
