// The D1 revocation must complete before releasing the AFS lock. A timeout or
// unknown result leaves policy edits blocked; it never guesses that a writer died.
export async function recoverAdmissions({ read, revoke, release }, now = Date.now()) {
  const state = await read();
  for (const [token, admission] of Object.entries(state.admissions)) {
    if (Date.parse(admission.startedAt) > now - 60000) continue;
    await revoke(token, admission.revision);
    await release(token);
  }
}
