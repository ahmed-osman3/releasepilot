import { randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(time: number, length: number): string {
  let str = "";
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % 32;
    str = CROCKFORD[mod] + str;
    time = (time - mod) / 32;
  }
  return str;
}

function encodeRandom(length: number): string {
  const bytes = randomBytes(length);
  let str = "";
  for (let i = 0; i < length; i++) {
    str += CROCKFORD[bytes[i] % 32];
  }
  return str;
}

export function ulid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}
