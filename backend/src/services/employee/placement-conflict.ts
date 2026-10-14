export function rethrowPlacementConflict(error: unknown): never {
  const failure = error as { code?: string; cause?: { code?: string } };
  if (failure?.code === "P2002" || failure?.code === "23505" || failure?.cause?.code === "23505") {
    throw new Error("Employee already has a scheduled or active assignment. Refresh the employee record before trying again.");
  }
  throw error;
}
