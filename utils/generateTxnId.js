import { nanoid } from "nanoid"

export function generateTxnId() {
  return `TXN-${nanoid(8).toUpperCase()}`;
}