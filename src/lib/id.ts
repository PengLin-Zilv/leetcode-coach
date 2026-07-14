import { v7 as uuidv7 } from "uuid";

export type IdGenerator = () => string;

export const createId: IdGenerator = () => uuidv7();
