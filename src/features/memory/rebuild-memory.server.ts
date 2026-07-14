import "server-only";

import { systemClock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { getTrainingRepository } from "../training/training-repository.server";
import {
  rebuildMemoryProjection,
  type RebuildMemoryDependencies,
} from "./rebuild-memory";

export type { RebuildMemoryDependencies } from "./rebuild-memory";

function runtimeDependencies(): RebuildMemoryDependencies {
  return {
    repository: getTrainingRepository(),
    ids: createId,
    clock: systemClock,
  };
}

export function rebuildMemory(
  dependencies: RebuildMemoryDependencies = runtimeDependencies(),
) {
  return rebuildMemoryProjection(dependencies);
}
