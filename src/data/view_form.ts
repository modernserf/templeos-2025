import { Rec } from ".";
import { l, seq, s, $, Expr, Box, List, __, u } from "../expr";

type ClickParam = Box<"meta_key", []>;
type ClickEvent = Box<"click", [List<ClickParam>]>;
export type ButtonEvent = ClickEvent;

export type ChangeEvent = Box<"change", [Expr]>;
export type FocusEvent = Box<"focus", []>;
export type BlurEvent = Box<"blur", []>;
export type InputEvent = ChangeEvent | FocusEvent | BlurEvent;

export const viewForm = {
  view__button: {
    rule__params: l(
      s.Button($.params, $.label, $.handler),
      $.params,
      $.label,
      $.handler,
    ),
  },
  view__input: {
    rule__params: l(
      s.Input($.props, $.value, $.handler),
      $.props,
      $.value,
      $.handler,
    ),
  },
  view__textarea: {
    rule__params: l(
      s.Textarea($.props, $.value, $.handler),
      $.props,
      $.value,
      $.handler,
    ),
  },
  view__select: {
    rule__params: l(
      s.Select($.params, $.value, $.options, $.handler),
      $.params,
      $.value,
      $.options,
      $.handler,
    ),
  },
  view__menu: {
    rule__params: l($.out, $.params, $.label, $.options, $.handler),
    rule__body: seq(
      s.append_left_right($.menu_options, l(s.option("", $.label)), $.options),
      s.view__select($.out, $.params, $.label, $.menu_options, $.handler),
    ),
  },
  on_click: {
    rule__params: l(s.click(__), $.fn),
    rule__body: seq($.fn, s.ok()),
  },
  on_change: {
    rule__params: l($.e, $.fn),
    rule__body: seq(u($.e, s.change($.value)), s.apply(l($.value), $.fn)),
  },
} satisfies Record<string, Rec>;
