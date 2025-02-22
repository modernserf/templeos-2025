import { Rec } from ".";
import { l, seq, s, $, Expr, Box, List } from "../expr";

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
  view__fit_content_input: {
    rule__params: l($.out, $.value, $.handler),
    rule__body: s.view__input(
      $.out,
      l(s.class("Input--fitContent"), s.debounce(300)),
      $.value,
      $.handler,
    ),
  },
} satisfies Record<string, Rec>;
