import { nanoid } from "nanoid";

export default function generateReferralCode() {
  return `REF-${nanoid(6).toUpperCase()}`;
}