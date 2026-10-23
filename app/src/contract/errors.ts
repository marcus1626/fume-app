// Errors: what a call fails with, by kind (code) and in words (message).

export type FumeErrorCode = "not_found" | "forbidden" | "conflict" | "invalid" | "unavailable";

export class FumeError extends Error {
  constructor(
    public code: FumeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FumeError";
  }
}
