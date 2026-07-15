import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAttempt: vi.fn(),
  insertAttempt: vi.fn(),
  rebuildMemory: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../features/memory/rebuild-memory.server", () => ({
  rebuildMemory: mocks.rebuildMemory,
}));
vi.mock("../../../features/training/training-repository.server", () => ({
  getTrainingRepository: () => ({
    getAttempt: mocks.getAttempt,
    insertAttempt: mocks.insertAttempt,
  }),
}));

import { retryMemoryProjectionAction } from "./actions.server";

const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abc";

describe("retryMemoryProjectionAction", () => {
  beforeEach(() => {
    mocks.getAttempt.mockReset().mockResolvedValue({ id: attemptId });
    mocks.insertAttempt.mockReset();
    mocks.rebuildMemory.mockReset().mockResolvedValue([]);
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.revalidatePath.mockReset();
  });

  it("rebuilds from source Attempts and revalidates every projection consumer", async () => {
    await expect(retryMemoryProjectionAction(attemptId)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.rebuildMemory).toHaveBeenCalledOnce();
    expect(mocks.insertAttempt).not.toHaveBeenCalled();
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/today"],
      ["/progress"],
      [`/feedback/${attemptId}`],
    ]);
    expect(mocks.redirect).toHaveBeenCalledWith(`/feedback/${attemptId}`);
  });

  it("does not rebuild for a missing Attempt", async () => {
    mocks.getAttempt.mockResolvedValue(null);

    await expect(retryMemoryProjectionAction(attemptId)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.rebuildMemory).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/today");
  });
});
