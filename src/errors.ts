// Exit codes a program can branch on.
export const EXIT = {
  ok: 0,
  refused: 1,
  usage: 2,
  key: 3,
  slowDown: 4,
  unreachable: 5,
  notConfirmed: 6,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exit: number,
  ) {
    super(message);
  }
}

export const usage = (message: string) => new CliError(message, EXIT.usage);
