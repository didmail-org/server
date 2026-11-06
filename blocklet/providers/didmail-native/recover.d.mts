export function recoverAdmissions(ports: {
  read(): Promise<{ admissions: Record<string, { revision: number; startedAt: string }> }>;
  revoke(token: string, revision: number): Promise<unknown>;
  release(token: string): Promise<unknown>;
}, now?: number): Promise<void>;
