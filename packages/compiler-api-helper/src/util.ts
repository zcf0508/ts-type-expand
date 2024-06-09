import type * as ts from 'typescript'
import type { SourceFileLocation } from './type-object'

export type Result<S, T> = ResultOk<S> | ResultNg<T>
export type ResultOk<T> = {
  __type: 'ok'
  ok: T
}
export type ResultNg<T> = {
  __type: 'ng'
  ng: T
}

export function isOk<T, E>(result: Result<T, E>): result is ResultOk<T> {
  return result.__type === 'ok'
}

export function isNg<T, E>(result: Result<T, E>): result is ResultNg<E> {
  return result.__type === 'ng'
}

export function ok<T>(value: T): ResultOk<T> {
  return {
    __type: 'ok',
    ok: value,
  }
}

export function ng<T>(value: T): ResultNg<T> {
  return {
    __type: 'ng',
    ng: value,
  }
}

type IsMatch<T> = (target: T) => boolean
type SwitchResolve<Arg, R> = (arg: Arg) => R

type SwitchResult<T, R> = {
  case: <
    CaseR,
    // eslint-disable-next-line @typescript-eslint/ban-types
    Predicate = {},
    Resolved = Omit<T, keyof Predicate> & Predicate,
  >(
    isMatch: (target: T) => boolean,
    resolve: SwitchResolve<Resolved, CaseR>,
  ) => SwitchResult<T, R | CaseR>
  default: <Default>(resolve: SwitchResolve<T, Default>) => R | Default
  resolved?: R
}

const toResult = <T, R, ExtractT = T>(
  target: T,
  isParentMatch: IsMatch<T>,
  resolveParent: SwitchResolve<ExtractT, R>,
  parentResolved: R | undefined,
): SwitchResult<T, R> => {
  const resolved =
    typeof parentResolved === 'undefined'
      ? isParentMatch(target)
        ? resolveParent(target as unknown as ExtractT)
        : undefined
      : parentResolved

  return {
    resolved,
    default: <Default>(resolveDefault: (arg: T) => Default): R | Default =>
      resolved ?? resolveDefault(target),
    case: <
      CaseR,
      Predicate extends {
        [K in keyof T]?: T[K]
        // eslint-disable-next-line @typescript-eslint/ban-types
      } = {},
      Resolved = Omit<T, keyof Predicate> & Predicate,
    >(
      isMatch: (target: T) => boolean,
      resolve: SwitchResolve<Resolved, CaseR>,
    ): SwitchResult<T, R | CaseR> =>
      toResult<T, R | CaseR, Resolved>(target, isMatch, resolve, resolved),
  }
}

export const switchExpression = <T>(target: T): SwitchResult<T, never> => {
  return {
    resolved: undefined,
    default: <Default>(resolveDefault: (arg: T) => Default): Default =>
      resolveDefault(target),
    case: <
      CaseR,
      // eslint-disable-next-line @typescript-eslint/ban-types
      Predicate = {},
      Resolved = Omit<T, keyof Predicate> & Predicate,
    >(
      isMatch: IsMatch<T>,
      resolve: SwitchResolve<Resolved, CaseR>,
    ): SwitchResult<T, CaseR> =>
      toResult<T, CaseR, Resolved>(target, isMatch, resolve, undefined),
  }
}

type Append<Item, Tuple extends unknown[]> = [Item, ...Tuple]
export type ArrayAtLeastN<
  T,
  N extends number = 1,
  Tuple = TupleN<N, T>,
> = Tuple extends T[] ? [...Tuple, ...T[]] : never
export type TupleN<Num extends number, T, TupleT extends T[] = []> = {
  current: TupleT
  next: TupleN<Num, T, Append<T, TupleT>>
}[TupleT extends { length: Num } ? 'current' : 'next']

export function assertMinLength<T, L extends number>(
  arr: T[],
  length: L,
): ArrayAtLeastN<T, L> {
  if (arr.length < length) {
    throw new TypeError(
      `Type assertion failed. arr.length should be gt ${length}, but get ${arr.length}`,
    )
  }
  return arr as unknown as ArrayAtLeastN<T, L>
}

/**
 * @internal
 */
export type SymbolInternal = ts.Symbol & {
  checkFlags: number
  type?: ts.Type
  parent?: SymbolInternal
  target?: SymbolInternal
}

export function getNodeSymbol(
  typeChecker: ts.TypeChecker,
  node?: ts.Node,
): ts.Symbol | undefined {
  return node
    ? (node as ts.Node & { symbol?: SymbolInternal }).symbol ??
        typeChecker.getSymbolAtLocation(node)
    : undefined
}

export function isValidType(type: ts.Type): boolean {
  return (
    !('intrinsicName' in type) ||
    (type as unknown as { intrinsicName: string }).intrinsicName !== 'error'
  )
}

export function getSymbolDeclaration(
  symbol?: ts.Symbol,
): ts.Declaration | undefined {
  return symbol
    ? symbol.valueDeclaration ?? symbol.declarations?.[0]
    : undefined
}

export function getSymbolType(
  typeChecker: ts.TypeChecker,
  symbol: ts.Symbol,
  location?: ts.Node,
) {
  if (location) {
    const type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)

    if (isValidType(type)) {
      return type
    }
  }

  const declaration = getSymbolDeclaration(symbol)
  if (declaration) {
    const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration)
    if (isValidType(type)) {
      return type
    }
  }

  const symbolType = typeChecker.getDeclaredTypeOfSymbol(symbol)
  if (isValidType(symbolType)) {
    return symbolType
  }

  const fallbackType = typeChecker.getTypeOfSymbolAtLocation(symbol, {
    parent: {},
  } as unknown as ts.Node)
  return fallbackType
}

export function getSourceFileLocation(
  sourceFile: ts.SourceFile,
  node: ts.Node,
): SourceFileLocation | undefined {
  const startPos = node.getStart()
  const endPos = node.getEnd()

  if (startPos < 0 || endPos < 0) {
    return undefined
  }

  const start = sourceFile.getLineAndCharacterOfPosition(startPos)
  const end = sourceFile.getLineAndCharacterOfPosition(endPos)

  return {
    fileName: sourceFile.fileName,
    range: {
      start,
      end,
    },
  }
}

/**
 * @internal
 */
export type NodeWithJsDoc = ts.Node & { jsDoc?: ts.Node[] | undefined }

export function getDescendantAtPosition(
  _ts: typeof ts,
  sourceFile: ts.SourceFile,
  position: number,
) {
  return getDescendantAtRange(_ts, sourceFile, [position, position])
}

/**
 * https://github.com/dsherret/ts-ast-viewer/blob/b4be8f2234a1c3c099296bf5d0ad6cc14107367c/site/src/compiler/getDescendantAtRange.ts
 */
export function getDescendantAtRange(
  _ts: typeof ts,
  sourceFile: ts.SourceFile,
  range: [number, number],
) {
  let bestMatch: { node: ts.Node; start: number } = {
    node: sourceFile,
    start: sourceFile.getStart(sourceFile),
  }

  searchDescendants(sourceFile)
  return bestMatch.node

  function searchDescendants(node: ts.Node) {
    const children: ts.Node[] = []
    node.forEachChild((child) => {
      children.push(child)
      return undefined
    })

    for (const child of children) {
      if (child.kind !== _ts.SyntaxKind.SyntaxList) {
        if (isBeforeRange(child.end)) {
          continue
        }

        const childStart = getStartSafe(child, sourceFile)

        if (isAfterRange(childStart)) {
          return
        }

        if (childStart <= range[0] && child.end >= range[1]) {
          console.log(child.getFullText())
          bestMatch = { node: child, start: childStart }
        }
      }

      searchDescendants(child)
    }
  }

  function isBeforeRange(pos: number) {
    return pos < range[0]
  }

  function isAfterRange(nodeEnd: number) {
    return nodeEnd >= range[0] && nodeEnd > range[1]
  }

  function getStartSafe(node: ts.Node, sourceFile: ts.SourceFile) {
    // workaround for compiler api bug with getStart(sourceFile, true) (see PR #35029 in typescript repo)
    const jsDocs = (node as NodeWithJsDoc).jsDoc
    if (jsDocs && jsDocs.length > 0 && jsDocs[0]) {
      return jsDocs[0].getStart(sourceFile)
    }
    return node.getStart(sourceFile)
  }
}

/**
 * @internal
 */
export function filterUndefined<T>(arr: T[]): Exclude<T, undefined>[] {
  return arr.filter((x) => x !== undefined) as Exclude<T, undefined>[]
}
