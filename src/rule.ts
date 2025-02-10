import { Rec } from "./data";
import { ruleCore } from "./rule__core";
import { ruleDB } from "./rule_db";
import { ruleBox } from "./rule_box";
import { ruleType } from "./rule_type";
import { clipboardRules } from "./clipboard";

export const rules = {
  ...ruleCore,
  ...ruleType,
  ...ruleBox,
  ...ruleDB,
  ...clipboardRules,
} satisfies Record<string, Rec>;
