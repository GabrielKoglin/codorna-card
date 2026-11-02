/**
 * Consultas do modo completo (`private-token`). Privacidade por construção: nenhuma delas pede
 * nome de repositório, de dono, de branch, mensagem de commit, título, corpo ou URL. Só ids
 * opacos, datas, contagens e nomes de linguagem. O login pedido é o da própria pessoa do token,
 * para conferir que o token é dela. Um teste lê este arquivo e recusa campos com nomes.
 */

export const PRIVATE_PROFILE_QUERY = /* GraphQL */ `
  query CodornaPrivateProfile($merged: String!, $mergedElsewhere: String!) {
    rateLimit {
      remaining
      resetAt
    }
    viewer {
      id
      login
    }
    merged: search(type: ISSUE, query: $merged, first: 1) {
      issueCount
    }
    mergedElsewhere: search(type: ISSUE, query: $mergedElsewhere, first: 1) {
      issueCount
    }
  }
`

/**
 * Repositórios privados que o token enxerga, de todos os vínculos (próprios, como colaborador e
 * de organizações), sem forks. Forks e públicos ficam de fora para não contar de novo o que o
 * fluxo público já conta.
 */
export const PRIVATE_REPOSITORIES_QUERY = /* GraphQL */ `
  query CodornaPrivateRepositories($cursor: String) {
    rateLimit {
      remaining
      resetAt
    }
    viewer {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        isFork: false
        privacy: PRIVATE
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isPrivate
          isFork
          owner {
            id
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`

/** Commits de autoria da pessoa (pelo id) na branch padrão de um repositório, de 100 em 100. */
export const PRIVATE_HISTORY_QUERY = /* GraphQL */ `
  query CodornaPrivateHistory(
    $id: ID!
    $author: ID!
    $since: GitTimestamp!
    $until: GitTimestamp!
    $cursor: String
  ) {
    rateLimit {
      remaining
      resetAt
    }
    node(id: $id) {
      ... on Repository {
        defaultBranchRef {
          target {
            ... on Commit {
              history(
                first: 100
                after: $cursor
                author: { id: $author }
                since: $since
                until: $until
              ) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  oid
                  authoredDate
                }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Um ano: issues, PRs abertos e reviews em repositórios privados, por busca com `is:private`, e,
 * com `$withRestricted`, o `restrictedContributionsCount` visto por este token (só o que nem ele
 * enxerga).
 */
export const PRIVATE_YEAR_QUERY = /* GraphQL */ `
  query CodornaPrivateYear(
    $login: String!
    $from: DateTime!
    $to: DateTime!
    $withRestricted: Boolean!
    $issues: String!
    $pullRequests: String!
    $reviews: String!
  ) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) @include(if: $withRestricted) {
      contributionsCollection(from: $from, to: $to) {
        restrictedContributionsCount
      }
    }
    issues: search(type: ISSUE, query: $issues, first: 1) {
      issueCount
    }
    pullRequests: search(type: ISSUE, query: $pullRequests, first: 1) {
      issueCount
    }
    reviews: search(type: ISSUE, query: $reviews, first: 1) {
      issueCount
    }
  }
`

export interface PrivateProfileResponse {
  viewer: { id: string; login: string } | null
  merged: { issueCount: number }
  mergedElsewhere: { issueCount: number }
}

export interface PrivateRepositoryNode {
  id: string
  isPrivate: boolean
  isFork: boolean
  owner: { id: string } | null
  languages: {
    edges: ({ size: number; node: { name: string; color: string | null } } | null)[] | null
  } | null
}

export interface PrivateRepositoriesResponse {
  viewer: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: (PrivateRepositoryNode | null)[] | null
    } | null
  } | null
}

export interface PrivateHistoryResponse {
  node: {
    defaultBranchRef: {
      target: {
        history?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
          nodes: ({ oid: string; authoredDate: string } | null)[] | null
        }
      } | null
    } | null
  } | null
}

export interface PrivateYearResponse {
  user?: { contributionsCollection: { restrictedContributionsCount: number } } | null
  issues: { issueCount: number }
  pullRequests: { issueCount: number }
  reviews: { issueCount: number }
}
