import { describe, expect, it } from "vitest";
import { NotInBoutiqlyError, requestUserContext } from "./boutiqly.ts";

function fakeWindow() {
  const listeners = new Set<(e: MessageEvent) => void>();
  return {
    listeners,
    addEventListener: (_: "message", fn: (e: MessageEvent) => void) => listeners.add(fn),
    removeEventListener: (_: "message", fn: (e: MessageEvent) => void) => listeners.delete(fn),
    emit: (source: unknown, data: unknown) => listeners.forEach((fn) => fn({ source, data } as MessageEvent)),
  };
}

describe("asking Boutiqly who's looking", () => {
  it("sends REQUEST_USER_DATA and resolves with the parent's payload", async () => {
    const win = fakeWindow();
    const sent: unknown[] = [];
    const parent = { postMessage: (m: unknown) => sent.push(m) };
    const result = requestUserContext(parent, win, 1000);
    expect(sent).toEqual([{ message: "REQUEST_USER_DATA" }]);
    win.emit({}, { message: "REQUEST_USER_DATA_RESPONSE", payload: "from-someone-else" });
    win.emit(parent, { message: "SOMETHING_ELSE", payload: "x" });
    win.emit(parent, { message: "REQUEST_USER_DATA_RESPONSE", payload: "encrypted" });
    await expect(result).resolves.toBe("encrypted");
    expect(win.listeners.size).toBe(0);
  });

  it("fails clearly outside Boutiqly or when it doesn't answer", async () => {
    await expect(requestUserContext(null, fakeWindow())).rejects.toBeInstanceOf(NotInBoutiqlyError);
    await expect(requestUserContext({ postMessage() {} }, fakeWindow(), 10)).rejects.toBeInstanceOf(NotInBoutiqlyError);
  });
});
