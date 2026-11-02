import { describe, expect, it } from 'vitest'
import { normalizeOutput, outputFiles, readInputs } from '../src/inputs'

const env = (inputs: Record<string, string>, extra: Record<string, string> = {}) => ({
  GITHUB_REPOSITORY_OWNER: 'Pixel-Dev',
  INPUT_TOKEN: 'segredo',
  ...Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [`INPUT_${key.toUpperCase()}`, value]),
  ),
  ...extra,
})

describe('entradas', () => {
  it('usa os padrões', () => {
    expect(readInputs(env({}))).toEqual({
      username: 'Pixel-Dev',
      token: 'segredo',
      output: 'codorna-card.svg',
      theme: 'dark',
      lang: 'pt-BR',
      commit: true,
    })
  })

  it('aceita valores válidos com espaços e maiúsculas', () => {
    const inputs = readInputs(
      env({
        username: ' outra-pessoa ',
        theme: 'Both',
        lang: 'en-US',
        commit: 'False',
        output: './cards/meu.svg',
      }),
    )
    expect(inputs).toMatchObject({
      username: 'outra-pessoa',
      theme: 'both',
      lang: 'en',
      commit: false,
      output: 'cards/meu.svg',
    })
  })

  it('recusa entradas inválidas com mensagem no idioma escolhido', () => {
    expect(() => readInputs(env({ username: 'nome com espaço' }))).toThrow('Username inválido')
    expect(() => readInputs(env({ username: '-hifen' }))).toThrow('Username inválido')
    expect(() => readInputs(env({ theme: 'sepia', lang: 'en' }))).toThrow('Invalid theme: "sepia"')
    expect(() => readInputs(env({ commit: 'talvez' }))).toThrow('Valor inválido em commit')
    expect(() => readInputs(env({ output: '../fora.svg' }))).toThrow('Saída inválida')
    expect(() => readInputs(env({ lang: 'fr' }))).toThrow(
      'Idioma inválido: "fr". Use pt-BR ou en. / Invalid language',
    )
    expect(() => readInputs(env({ token: '' }))).toThrow('Nenhum token')
  })
})

describe('caminho de saída', () => {
  it('normaliza e protege o repositório', () => {
    expect(normalizeOutput('')).toBe('codorna-card.svg')
    expect(normalizeOutput('img\\card.svg')).toBe('img/card.svg')
    expect(normalizeOutput('a/./b/../card.SVG')).toBe('a/card.SVG')
    expect(normalizeOutput('/etc/card.svg')).toBeNull()
    expect(normalizeOutput('C:/card.svg')).toBeNull()
    expect(normalizeOutput('../card.svg')).toBeNull()
    expect(normalizeOutput('a/../../card.svg')).toBeNull()
    expect(normalizeOutput('card.png')).toBeNull()
    expect(normalizeOutput('.git/hooks/card.svg')).toBeNull()
  })

  it('both gera -dark e -light', () => {
    expect(outputFiles('img/codorna-card.svg', 'both')).toEqual([
      { theme: 'dark', path: 'img/codorna-card-dark.svg' },
      { theme: 'light', path: 'img/codorna-card-light.svg' },
    ])
    expect(outputFiles('codorna-card.svg', 'light')).toEqual([
      { theme: 'light', path: 'codorna-card.svg' },
    ])
  })
})
