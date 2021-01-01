import { Accounts, Signers } from "./";
import { Arbitrager } from "../typechain";

declare module "mocha" {
  export interface Context {
    accounts: Accounts;
    signers: Signers;
    // greeter: Greeter;
    arbitrager: Arbitrager;
  }
}
