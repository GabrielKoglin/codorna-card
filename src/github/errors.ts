export type ErrorCode =
  | 'input'
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'not-user'
  | 'rate-limit'
  | 'secondary-rate-limit'
  | 'timeout'
  | 'network'
  | 'api'
  | 'graphql'
  | 'permission'
  | 'empty-repository'
  | 'branch'
  | 'protected-branch'

/** Erro com mensagem pronta para mostrar a quem usa a Action. */
export class GuildCardError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'GuildCardError'
  }
}
