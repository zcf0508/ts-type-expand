import type * as ts from 'typescript'
import type { ArrayAtLeastN } from './util'

export type TextRange = {
  start: ts.LineAndCharacter
  end: ts.LineAndCharacter
}

export type SourceFileLocation = {
  range: TextRange
  fileName: string
}

export type TypeObject =
  | PrimitiveTO
  | LiteralTO
  | SpecialTO
  | ArrayTO
  | TupleTO
  | UnionTO
  | EnumTO
  | CallableTO
  | PromiseTO
  | PromiseLikeTO
  | UnsupportedTO
  | ObjectTO

type WithTypeName = {
  typeName: string
}

export type PrimitiveTO = {
  __type: 'PrimitiveTO'
  kind: 'string' | 'number' | 'bigint' | 'boolean'
  locations: SourceFileLocation[]
}

export type SpecialTO = {
  __type: 'SpecialTO'
  kind:
    | 'null'
    | 'undefined'
    | 'any'
    | 'unknown'
    | 'never'
    | 'void'
    | 'Date'
    | 'unique symbol'
    | 'Symbol'
  locations: SourceFileLocation[]
}

export type LiteralTO = {
  __type: 'LiteralTO'
  value: unknown
  locations: SourceFileLocation[]
}

export type ArrayTO = WithTypeName & {
  __type: 'ArrayTO'
  child: TypeObject
  locations: SourceFileLocation[]
}

export type TupleTO = WithTypeName & {
  __type: 'TupleTO'
  items: TypeObject[]
  locations: SourceFileLocation[]
}

export type ObjectTO = WithTypeName & {
  __type: 'ObjectTO'
  storeKey: string
  locations: SourceFileLocation[]
}

export type UnionTO = WithTypeName & {
  __type: 'UnionTO'
  unions: ArrayAtLeastN<TypeObject, 2>
  locations: SourceFileLocation[]
}

export type EnumTO = WithTypeName & {
  __type: 'EnumTO'
  enums: {
    name: string
    type: LiteralTO
  }[]
  locations: SourceFileLocation[]
}

export type CallableArgument = {
  name: string
  type: TypeObject
}

export type CallableTO = {
  __type: 'CallableTO'
  argTypes: {
    name: string
    type: TypeObject
    // should support optional arguments?
  }[]
  returnType: TypeObject
  locations: SourceFileLocation[]
}

export type PromiseLikeTO = {
  __type: 'PromiseLikeTO'
  child: TypeObject
  locations: SourceFileLocation[]
}

export type PromiseTO = {
  __type: 'PromiseTO'
  child: TypeObject
  locations: SourceFileLocation[]
}

/**
 * @property kind -- identifier of why converted as unsupported
 */
export type UnsupportedTO = {
  __type: 'UnsupportedTO'
  kind:
    | 'arrayT'
    | 'prop'
    | 'convert'
    | 'function'
    | 'unresolvedTypeParameter'
    | 'promiseNoArgument'
    | 'enumValNotFound'
  typeText?: string
  locations: SourceFileLocation[]
}

export function primitive(
  kind: PrimitiveTO['kind'],
): Omit<PrimitiveTO, 'locations'> {
  return {
    __type: 'PrimitiveTO',
    kind,
  }
}

export function special(kind: SpecialTO['kind']): Omit<SpecialTO, 'locations'> {
  return {
    __type: 'SpecialTO',
    kind,
  }
}
