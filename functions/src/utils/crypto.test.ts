import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("encryptSecret", () => {
  it("bolak-balik dan tidak menyimpan teks asli", () => {
    const enc = encryptSecret("THQWJ-token-rahasia", key);
    expect(JSON.stringify(enc)).not.toContain("token-rahasia");
    expect(decryptSecret(enc, key)).toBe("THQWJ-token-rahasia");
  });

  it("IV acak: enkripsi yang sama menghasilkan ciphertext berbeda", () => {
    expect(encryptSecret("x", key).data).not.toBe(encryptSecret("x", key).data);
  });

  it("menolak kunci salah dan data yang dimanipulasi", () => {
    const enc = encryptSecret("token", key);
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
    const tampered = { ...enc, data: Buffer.from("lain").toString("base64") };
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => encryptSecret("x", "pendek")).toThrow(/32 byte/);
  });
});
