import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createId: vi.fn(() => "0198b8e8-63b6-7000-8000-000000000001"),
  getProfile: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../lib/id", () => ({ createId: mocks.createId }));
vi.mock("../../features/training/training-repository.server", () => ({
  getTrainingRepository: () => ({
    getProfile: mocks.getProfile,
    saveProfile: mocks.saveProfile,
  }),
}));

import { saveProfileAction } from "./actions.server";

function validProfileForm(): FormData {
  const formData = new FormData();
  formData.set("deadline", "2099-08-31");
  formData.set("sessionsPerWeek", "4");
  formData.set("minutesPerSession", "30");
  formData.set("startingLevel", "new");
  return formData;
}

describe("saveProfileAction", () => {
  beforeEach(() => {
    mocks.createId.mockClear();
    mocks.getProfile.mockReset();
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.revalidatePath.mockReset();
    mocks.saveProfile.mockReset();
  });

  it("returns field errors without echoing unexpected form input", async () => {
    const formData = validProfileForm();
    formData.set("deadline", "not-a-date");
    formData.set("unexpected", "private-unexpected-value");

    const result = await saveProfileAction({}, formData);

    expect(result.fieldErrors?.deadline).toBeDefined();
    expect(JSON.stringify(result)).not.toContain("private-unexpected-value");
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("updates the singleton Profile without generating or replacing its ID", async () => {
    const existingProfile = {
      id: "0198b8e8-63b6-7000-8000-000000000099",
      deadline: "2099-07-31",
      sessionsPerWeek: 3,
      minutesPerSession: 15,
      startingLevel: "some" as const,
    };
    mocks.getProfile.mockResolvedValue(existingProfile);
    mocks.saveProfile.mockResolvedValue(undefined);

    await expect(saveProfileAction({}, validProfileForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.createId).not.toHaveBeenCalled();
    expect(mocks.saveProfile).toHaveBeenCalledWith({
      id: existingProfile.id,
      deadline: "2099-08-31",
      sessionsPerWeek: 4,
      minutesPerSession: 30,
      startingLevel: "new",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/today"],
      ["/progress"],
    ]);
    expect(mocks.redirect).toHaveBeenCalledWith("/today");
  });
});
