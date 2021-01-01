import { Signer } from "@ethersproject/abstract-signer";

export interface Accounts {
  admin: string;
  hunter: string;
}

export interface Signers {
  admin: Signer;
  hunter: Signer;
}
