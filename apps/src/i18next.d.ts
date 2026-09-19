// Typo'd t() keys become compile errors. The runtime keyset-parity test in
// i18n.test.ts is the enforced gate; this is the editor-time layer on top.
import type { resources } from "./i18n";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["ko"];
  }
}
