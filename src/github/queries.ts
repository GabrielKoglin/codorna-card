/**
 * Consultas GraphQL. Tudo é filtrado para dados públicos: repositórios com
 * `isPrivate` são descartados mesmo que o token consiga enxergá-los.
 */

export const PROFILE_QUERY = /* GraphQL */ `
  query GuildProfile($login: String!, $merged: String!, $mergedElsewhere: String!) {
    rateLimit {
      remaining
      resetAt
    }
    owner: repositoryOwner(login: $login) {
      __typename
      login
      ... on User {
        createdAt
      }
    }
    merged: search(type: ISSUE, query: $merged, first: 1) {
      issueCount
    }
    mergedElsewhere: search(type: ISSUE, query: $mergedElsewhere, first: 1) {
      issueCount
    }
  }
`

export const REPOSITORIES_QUERY = /* GraphQL */ `
  query GuildRepositories($login: String!, $cursor: String) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        isFork: false
        privacy: PUBLIC
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          isPrivate
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

const COMMIT_DAYS_FRAGMENT = /* GraphQL */ `
  fragment GuildCommitDays on ContributionsCollection {
    commitContributionsByRepository(maxRepositories: 100) {
      repository {
        isPrivate
      }
      contributions(first: 100) {
        totalCount
        nodes {
          occurredAt
          commitCount
        }
      }
    }
  }
`

export const YEAR_QUERY = /* GraphQL */ `
  query GuildYear($login: String!, $from: DateTime!, $to: DateTime!) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        ...GuildCommitDays
        issueContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
      }
    }
  }
  ${COMMIT_DAYS_FRAGMENT}
`

/** Consulta só de commits, com uma janela por trimestre (no máximo 92 dias por repositório). */
export function quartersQuery(count: number): string {
  const variables = Array.from(
    { length: count },
    (_, i) => `$from${i}: DateTime!, $to${i}: DateTime!`,
  )
  const windows = Array.from(
    { length: count },
    (_, i) => `q${i}: contributionsCollection(from: $from${i}, to: $to${i}) { ...GuildCommitDays }`,
  )
  return `
  query GuildQuarters($login: String!, ${variables.join(', ')}) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      ${windows.join('\n      ')}
    }
  }
  ${COMMIT_DAYS_FRAGMENT}
`
}

export interface CommitDaysByRepository {
  repository: { isPrivate: boolean } | null
  contributions: {
    totalCount: number
    nodes: ({ occurredAt: string; commitCount: number } | null)[] | null
  }
}

export interface CountByRepository {
  repository: { isPrivate: boolean } | null
  contributions: { totalCount: number }
}

export interface ProfileResponse {
  owner: { __typename: string; login: string; createdAt?: string } | null
  merged: { issueCount: number }
  mergedElsewhere: { issueCount: number }
}

export interface RepositoriesResponse {
  user: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: ({
        name: string
        isPrivate: boolean
        languages: {
          edges: ({ size: number; node: { name: string; color: string | null } } | null)[] | null
        } | null
      } | null)[]
    }
  } | null
}

export interface YearResponse {
  user: {
    contributionsCollection: {
      commitContributionsByRepository: CommitDaysByRepository[]
      issueContributionsByRepository: CountByRepository[]
      pullRequestContributionsByRepository: CountByRepository[]
      pullRequestReviewContributionsByRepository: CountByRepository[]
    }
  } | null
}

export interface QuartersResponse {
  user: Record<string, { commitContributionsByRepository: CommitDaysByRepository[] }> | null
}
