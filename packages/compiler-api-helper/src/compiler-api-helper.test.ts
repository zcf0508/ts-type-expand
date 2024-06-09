import { resolve } from 'node:path'
import type { LiteralTO, TypeObject } from '.'
import { CompilerApiHelper } from '~/compiler-api-helper'
import { isOk } from '~/util'
import { createProgram } from './test-helpers/program'
import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'

const absolutePath = (path: string) => resolve(__dirname, '../../example', path)

const relativePath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(resolve(__dirname, '../../example').replace(/\\/g, '/'), '.')

const program = createProgram(absolutePath('./tsconfig.json'))
const helper = new CompilerApiHelper(program, ts)

function isTypeObjectArray(obj: unknown): obj is TypeObject[] {
  return Array.isArray(obj)
}

function isTypeObject(obj: unknown): obj is TypeObject {
  return !Array.isArray(obj) && obj !== null && typeof obj === 'object'
}

function transformLocations<T extends TypeObject>(obj: T | T[]): T | T[] {
  if (isTypeObjectArray(obj)) {
    return obj.map((item) => transformLocations(item as TypeObject) as T)
  } else if (isTypeObject(obj)) {
    if ('locations' in obj) {
      obj.locations = obj.locations.map((location) => {
        if (location.fileName && typeof location.fileName === 'string') {
          location.fileName = relativePath(location.fileName)
        }
        return location
      })
    }
    if ('child' in obj) {
      obj.child = transformLocations(obj.child) as T
    }
    if ('enums' in obj) {
      obj.enums = obj.enums.map((item) => {
        item.type = transformLocations(item.type) as LiteralTO
        return item
      })
    }
    if ('argTypes' in obj) {
      obj.argTypes = obj.argTypes.map((item) => {
        item.type = transformLocations(item.type) as TypeObject
        return item
      })
    }
    return obj
  }
  return obj
}

expect.addSnapshotSerializer({
  serialize(val) {
    if (Array.isArray(val)) {
      val = val.map((item) => {
        if ('type' in item) {
          item.type = transformLocations(item.type)
        }
        return item
      })
    } else if ('type' in val) {
      val.type = transformLocations(val.type)
    } else {
      val = transformLocations(val)
    }
    return JSON.stringify(val, null, 2)
  },
  test(val) {
    return val
  },
})

describe('convertType', () => {
  describe('patterns', () => {
    describe('variable', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/patterns/variable.ts'),
        )
        if (!isOk(typesResult)) {
          throw new TypeError(
            `TypeResult is ng, reason: ${typesResult.ng.reason}`,
          )
        }

        const [literalValue, functionValue] = typesResult.ok
        if (literalValue === undefined || functionValue === undefined) {
          throw new TypeError(`unexpectedly file value`)
        }

        return { literalValue, functionValue }
      }

      it('value declaration for literal should be resolved.', () => {
        const { literalValue } = getTypes()

        expect<{ typeName: string | undefined; type: TypeObject }>(literalValue)
          .toMatchInlineSnapshot(`
            {
              "typeName": "value",
              "type": {
                "__type": "LiteralTO",
                "value": "hello",
                "locations": [
                  {
                    "fileName": "./src/patterns/variable.ts",
                    "range": {
                      "start": {
                        "line": 0,
                        "character": 13
                      },
                      "end": {
                        "line": 0,
                        "character": 28
                      }
                    }
                  }
                ]
              }
            }
          `)
      })

      it('value declaration for function should be resolved.', () => {
        const { functionValue } = getTypes()

        expect<{ typeName: string | undefined; type: TypeObject }>(
          functionValue,
        ).toMatchInlineSnapshot(`
          {
            "typeName": "asyncFunc",
            "type": {
              "__type": "CallableTO",
              "argTypes": [],
              "returnType": {
                "__type": "PromiseTO",
                "child": {
                  "__type": "SpecialTO",
                  "kind": "void",
                  "locations": []
                },
                "locations": []
              },
              "locations": [
                {
                  "fileName": "./src/patterns/variable.ts",
                  "range": {
                    "start": {
                      "line": 1,
                      "character": 13
                    },
                    "end": {
                      "line": 1,
                      "character": 54
                    }
                  }
                }
              ]
            }
          }
        `)
      })
    })

    it('type which re-exports should be resolved.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/patterns/re-export/index.ts'),
      )
      if (!isOk(typesResult)) {
        throw new TypeError('Unexpected file')
      }

      const [reExportedValue] = typesResult.ok
      if (reExportedValue === undefined) {
        throw new TypeError('Unexpected file')
      }

      expect(reExportedValue.type.__type).toStrictEqual('ObjectTO')
      if (reExportedValue.type.__type !== 'ObjectTO') {
        return
      }

      expect(helper.getObjectProps(reExportedValue.type.storeKey))
        .toMatchInlineSnapshot(`
          [
            {
              "propName": "name",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/patterns/re-export/original.ts",
                    "range": {
                      "start": {
                        "line": 1,
                        "character": 2
                      },
                      "end": {
                        "line": 1,
                        "character": 14
                      }
                    }
                  }
                ]
              }
            }
          ]
        `)
    })
  })

  describe('types', () => {
    it('primitive type should be resolved.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/primitive.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const types = typesResult.ok
      expect(types.length).toStrictEqual(2)

      expect(types[0]?.type).toMatchInlineSnapshot(`
        {
          "__type": "PrimitiveTO",
          "kind": "string",
          "locations": [
            {
              "fileName": "./src/types/primitive.ts",
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 0,
                  "character": 24
                }
              }
            }
          ]
        }
      `)

      expect(types[1]?.type).toMatchInlineSnapshot(`
        {
          "__type": "PrimitiveTO",
          "kind": "number",
          "locations": [
            {
              "fileName": "./src/types/primitive.ts",
              "range": {
                "start": {
                  "line": 1,
                  "character": 0
                },
                "end": {
                  "line": 1,
                  "character": 24
                }
              }
            }
          ]
        }
      `)
    })

    describe('special', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/special.ts'),
        )
        expect(isOk(typesResult)).toBe(true)
        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const [undefinedType, nullType] = typesResult.ok
        if (undefinedType === undefined || nullType === undefined) {
          throw new TypeError('Unexpected file')
        }

        return {
          undefinedType,
          nullType,
        }
      }

      it('undefined should be resolved', () => {
        const { undefinedType } = getTypes()
        expect(undefinedType.type).toMatchInlineSnapshot(`
          {
            "__type": "SpecialTO",
            "kind": "undefined",
            "locations": [
              {
                "fileName": "./src/types/special.ts",
                "range": {
                  "start": {
                    "line": 0,
                    "character": 0
                  },
                  "end": {
                    "line": 0,
                    "character": 29
                  }
                }
              }
            ]
          }
        `)
      })

      it('undefined should be resolved', () => {
        const { nullType } = getTypes()
        expect(nullType.type).toMatchInlineSnapshot(`
          {
            "__type": "SpecialTO",
            "kind": "null",
            "locations": [
              {
                "fileName": "./src/types/special.ts",
                "range": {
                  "start": {
                    "line": 1,
                    "character": 0
                  },
                  "end": {
                    "line": 1,
                    "character": 24
                  }
                }
              }
            ]
          }
        `)
      })
    })

    it('literal type should be resolved.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/literal.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const types = typesResult.ok
      expect(types.length).toStrictEqual(3)

      expect(types[0]?.type).toMatchInlineSnapshot(`
        {
          "__type": "LiteralTO",
          "value": "hello",
          "locations": [
            {
              "fileName": "./src/types/literal.ts",
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 0,
                  "character": 27
                }
              }
            }
          ]
        }
      `)

      expect(types[1]?.type).toMatchInlineSnapshot(`
        {
          "__type": "LiteralTO",
          "value": 20,
          "locations": [
            {
              "fileName": "./src/types/literal.ts",
              "range": {
                "start": {
                  "line": 1,
                  "character": 0
                },
                "end": {
                  "line": 1,
                  "character": 20
                }
              }
            }
          ]
        }
      `)

      expect(types[2]?.type).toMatchInlineSnapshot(`
        {
          "__type": "LiteralTO",
          "value": true,
          "locations": [
            {
              "fileName": "./src/types/literal.ts",
              "range": {
                "start": {
                  "line": 2,
                  "character": 0
                },
                "end": {
                  "line": 2,
                  "character": 23
                }
              }
            }
          ]
        }
      `)
    })

    it('union type should be resolved.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/union.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const types = typesResult.ok
      const [type0, type1] = types
      expect(type0).toBeDefined()
      expect(type1).not.toBeDefined()
      if (!type0) {
        return
      }

      expect(type0.type).toMatchInlineSnapshot(`
        {
          "__type": "UnionTO",
          "typeName": "StrOrNumber",
          "unions": [
            {
              "__type": "PrimitiveTO",
              "kind": "string",
              "locations": []
            },
            {
              "__type": "PrimitiveTO",
              "kind": "number",
              "locations": []
            }
          ],
          "locations": [
            {
              "fileName": "./src/types/union.ts",
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 0,
                  "character": 41
                }
              }
            }
          ]
        }
      `)
    })

    describe('enum', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/enum.ts'),
        )
        expect(isOk(typesResult)).toBe(true)
        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const types = typesResult.ok
        const [basicEnum, enumWithValue, valueOfEnum] = types
        if (
          basicEnum === undefined ||
          enumWithValue === undefined ||
          valueOfEnum === undefined
        ) {
          throw new TypeError('Unexpected file')
        }

        return {
          basicEnum,
          enumWithValue,
          valueOfEnum,
        }
      }

      it('basic enum should be resolved.', () => {
        const { basicEnum } = getTypes()
        expect(basicEnum.type).toMatchInlineSnapshot(`
          {
            "__type": "EnumTO",
            "typeName": "BasicEnum",
            "enums": [
              {
                "name": "Red",
                "type": {
                  "__type": "LiteralTO",
                  "value": 0,
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 1,
                          "character": 2
                        },
                        "end": {
                          "line": 1,
                          "character": 5
                        }
                      }
                    }
                  ]
                }
              },
              {
                "name": "Blue",
                "type": {
                  "__type": "LiteralTO",
                  "value": 1,
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 2,
                          "character": 2
                        },
                        "end": {
                          "line": 2,
                          "character": 6
                        }
                      }
                    }
                  ]
                }
              },
              {
                "name": "Green",
                "type": {
                  "__type": "LiteralTO",
                  "value": 2,
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 3,
                          "character": 2
                        },
                        "end": {
                          "line": 3,
                          "character": 7
                        }
                      }
                    }
                  ]
                }
              }
            ],
            "locations": [
              {
                "fileName": "./src/types/enum.ts",
                "range": {
                  "start": {
                    "line": 0,
                    "character": 0
                  },
                  "end": {
                    "line": 4,
                    "character": 1
                  }
                }
              }
            ]
          }
        `)
      })

      it('enum with value should be resolved.', () => {
        const { enumWithValue } = getTypes()
        expect(enumWithValue.type).toMatchInlineSnapshot(`
          {
            "__type": "EnumTO",
            "typeName": "EnumWithValue",
            "enums": [
              {
                "name": "Red",
                "type": {
                  "__type": "LiteralTO",
                  "value": "red",
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 6,
                          "character": 2
                        },
                        "end": {
                          "line": 6,
                          "character": 13
                        }
                      }
                    }
                  ]
                }
              },
              {
                "name": "Blue",
                "type": {
                  "__type": "LiteralTO",
                  "value": "blue",
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 7,
                          "character": 2
                        },
                        "end": {
                          "line": 7,
                          "character": 15
                        }
                      }
                    }
                  ]
                }
              },
              {
                "name": "Green",
                "type": {
                  "__type": "LiteralTO",
                  "value": "green",
                  "locations": [
                    {
                      "fileName": "./src/types/enum.ts",
                      "range": {
                        "start": {
                          "line": 8,
                          "character": 2
                        },
                        "end": {
                          "line": 8,
                          "character": 17
                        }
                      }
                    }
                  ]
                }
              }
            ],
            "locations": [
              {
                "fileName": "./src/types/enum.ts",
                "range": {
                  "start": {
                    "line": 5,
                    "character": 0
                  },
                  "end": {
                    "line": 9,
                    "character": 1
                  }
                }
              }
            ]
          }
        `)
      })

      it('value of enum type should be resolved.', () => {
        const { valueOfEnum } = getTypes()
        expect(valueOfEnum.type).toMatchInlineSnapshot(`
          {
            "__type": "LiteralTO",
            "value": 0,
            "locations": [
              {
                "fileName": "./src/types/enum.ts",
                "range": {
                  "start": {
                    "line": 11,
                    "character": 13
                  },
                  "end": {
                    "line": 11,
                    "character": 34
                  }
                }
              }
            ]
          }
        `)
      })
    })

    describe('array', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/array.ts'),
        )
        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const [arrayLiteral, arrayGenerics, arrayInProp] = typesResult.ok
        if (
          arrayLiteral === undefined ||
          arrayGenerics === undefined ||
          arrayInProp === undefined
        ) {
          throw new TypeError('Unexpected file')
        }

        return {
          arrayLiteral,
          arrayGenerics,
          arrayInProp,
        }
      }

      it('array literal should be resolved.', () => {
        const { arrayLiteral } = getTypes()
        expect(arrayLiteral.type).toMatchInlineSnapshot(`
          {
            "__type": "ArrayTO",
            "typeName": "ArrStr",
            "child": {
              "__type": "UnsupportedTO",
              "kind": "arrayT",
              "locations": []
            },
            "locations": [
              {
                "fileName": "./src/types/array.ts",
                "range": {
                  "start": {
                    "line": 0,
                    "character": 0
                  },
                  "end": {
                    "line": 0,
                    "character": 29
                  }
                }
              }
            ]
          }
        `)
      })
      it('array generics should be resolved.', () => {
        const { arrayGenerics } = getTypes()
        expect(arrayGenerics.type).toMatchInlineSnapshot(`
          {
            "__type": "ArrayTO",
            "typeName": "ArrStr2",
            "child": {
              "__type": "UnsupportedTO",
              "kind": "arrayT",
              "locations": []
            },
            "locations": [
              {
                "fileName": "./src/types/array.ts",
                "range": {
                  "start": {
                    "line": 1,
                    "character": 0
                  },
                  "end": {
                    "line": 1,
                    "character": 35
                  }
                }
              }
            ]
          }
        `)
      })
      it('array in property should be resolved.', () => {
        const { arrayInProp } = getTypes()
        expect(arrayInProp.type.__type).toBe('ObjectTO')
        if (arrayInProp.type.__type !== 'ObjectTO') {
          return
        }

        expect(helper.getObjectProps(arrayInProp.type.storeKey)[0])
          .toMatchInlineSnapshot(`
            {
              "propName": "arr",
              "type": {
                "__type": "ArrayTO",
                "typeName": "string[]",
                "child": {
                  "__type": "PrimitiveTO",
                  "kind": "string",
                  "locations": []
                },
                "locations": [
                  {
                    "fileName": "./src/types/array.ts",
                    "range": {
                      "start": {
                        "line": 3,
                        "character": 2
                      },
                      "end": {
                        "line": 3,
                        "character": 20
                      }
                    }
                  }
                ]
              }
            }
          `)
      })
    })

    describe('object', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/object.ts'),
        )

        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const [obj, recursiveObj] = typesResult.ok
        if (obj === undefined || recursiveObj === undefined) {
          throw new TypeError('Unexpected file')
        }
        return { obj, recursiveObj }
      }

      it('object should be resolved.', () => {
        const { obj } = getTypes()
        expect(obj.type.__type).toStrictEqual('ObjectTO')
        if (obj.type.__type !== 'ObjectTO') {
          return
        }
        expect(helper.getObjectProps(obj.type.storeKey)).toMatchInlineSnapshot(`
          [
            {
              "propName": "name",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/types/object.ts",
                    "range": {
                      "start": {
                        "line": 1,
                        "character": 2
                      },
                      "end": {
                        "line": 1,
                        "character": 14
                      }
                    }
                  }
                ]
              }
            },
            {
              "propName": "names",
              "type": {
                "__type": "ArrayTO",
                "typeName": "string[]",
                "child": {
                  "__type": "PrimitiveTO",
                  "kind": "string",
                  "locations": []
                },
                "locations": []
              }
            },
            {
              "propName": "maybeName",
              "type": {
                "__type": "UnionTO",
                "typeName": "string | undefined",
                "unions": [
                  {
                    "__type": "SpecialTO",
                    "kind": "undefined",
                    "locations": []
                  },
                  {
                    "__type": "PrimitiveTO",
                    "kind": "string",
                    "locations": []
                  }
                ],
                "locations": [
                  {
                    "fileName": "./src/types/object.ts",
                    "range": {
                      "start": {
                        "line": 3,
                        "character": 2
                      },
                      "end": {
                        "line": 3,
                        "character": 20
                      }
                    }
                  }
                ]
              }
            },
            {
              "propName": "time",
              "type": {
                "__type": "SpecialTO",
                "kind": "Date",
                "locations": [
                  {
                    "fileName": "./src/types/object.ts",
                    "range": {
                      "start": {
                        "line": 4,
                        "character": 2
                      },
                      "end": {
                        "line": 4,
                        "character": 12
                      }
                    }
                  }
                ]
              }
            }
          ]
        `)
      })

      it('recursive object should be resolved.', () => {
        const { recursiveObj } = getTypes()
        expect(recursiveObj.type.__type).toStrictEqual('ObjectTO')
        if (recursiveObj.type.__type !== 'ObjectTO') {
          return
        }

        const propsOneRecursive = helper.getObjectProps(
          recursiveObj.type.storeKey,
        )
        expect(propsOneRecursive[0]).toMatchInlineSnapshot(`
          {
            "propName": "name",
            "type": {
              "__type": "PrimitiveTO",
              "kind": "string",
              "locations": [
                {
                  "fileName": "./src/types/object.ts",
                  "range": {
                    "start": {
                      "line": 8,
                      "character": 2
                    },
                    "end": {
                      "line": 8,
                      "character": 14
                    }
                  }
                }
              ]
            }
          }
        `)

        const recursiveProp = propsOneRecursive[1]?.type
        if (recursiveProp === undefined) {
          throw new TypeError('Unexpected undefined')
        }
        if (recursiveProp.__type !== 'ObjectTO') {
          throw new Error('Error')
        }
        expect(helper.getObjectProps(recursiveProp.storeKey)[0])
          .toMatchInlineSnapshot(`
            {
              "propName": "name",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/types/object.ts",
                    "range": {
                      "start": {
                        "line": 8,
                        "character": 2
                      },
                      "end": {
                        "line": 8,
                        "character": 14
                      }
                    }
                  }
                ]
              }
            }
          `)
      })
    })

    describe('generics', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/generics.ts'),
        )

        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const [resolvedGenerics] = typesResult.ok
        if (resolvedGenerics === undefined) {
          throw new TypeError('Unexpected file')
        }

        return {
          genericsWithDefault: undefined,
          genericsWithNoDefault: undefined,
          resolvedGenerics,
        }
      }

      it('generics with default type should be skipped.', () => {
        const { genericsWithDefault } = getTypes()
        expect(genericsWithDefault).toBeUndefined()
      })

      it('generics with no default type should be skipped.', () => {
        const { genericsWithNoDefault } = getTypes()
        expect(genericsWithNoDefault).toBeUndefined()
      })

      it('resolved generics should be resolved.', () => {
        const { resolvedGenerics } = getTypes()

        expect(resolvedGenerics.typeName).toBe('ResolvedGenerics')
        expect(resolvedGenerics.type.__type).toBe('ObjectTO')
        if (resolvedGenerics.type.__type !== 'ObjectTO') {
          return
        }
        expect(helper.getObjectProps(resolvedGenerics.type.storeKey))
          .toMatchInlineSnapshot(`
            [
              {
                "propName": "id",
                "type": {
                  "__type": "UnionTO",
                  "typeName": "number | undefined",
                  "unions": [
                    {
                      "__type": "SpecialTO",
                      "kind": "undefined",
                      "locations": []
                    },
                    {
                      "__type": "PrimitiveTO",
                      "kind": "number",
                      "locations": []
                    }
                  ],
                  "locations": [
                    {
                      "fileName": "./src/types/generics.ts",
                      "range": {
                        "start": {
                          "line": 12,
                          "character": 2
                        },
                        "end": {
                          "line": 12,
                          "character": 12
                        }
                      }
                    }
                  ]
                }
              },
              {
                "propName": "time",
                "type": {
                  "__type": "UnionTO",
                  "typeName": "Date | undefined",
                  "unions": [
                    {
                      "__type": "SpecialTO",
                      "kind": "undefined",
                      "locations": []
                    },
                    {
                      "__type": "SpecialTO",
                      "kind": "Date",
                      "locations": []
                    }
                  ],
                  "locations": [
                    {
                      "fileName": "./src/types/generics.ts",
                      "range": {
                        "start": {
                          "line": 13,
                          "character": 2
                        },
                        "end": {
                          "line": 13,
                          "character": 12
                        }
                      }
                    }
                  ]
                }
              }
            ]
          `)
      })
    })

    it('intersection type should be defined.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/intersection.ts'),
      )
      if (!isOk(typesResult)) {
        throw new TypeError('Unexpected file')
      }

      const [intersectionType] = typesResult.ok
      if (intersectionType === undefined) {
        throw new TypeError('Unexpected file')
      }

      // intersection
      expect(intersectionType).toBeDefined()
      expect(intersectionType.type.__type).toBe('ObjectTO')
      if (intersectionType.type.__type !== 'ObjectTO') {
        return
      }
      expect(helper.getObjectProps(intersectionType.type.storeKey))
        .toMatchInlineSnapshot(`
          [
            {
              "propName": "hoge",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/types/intersection.ts",
                    "range": {
                      "start": {
                        "line": 1,
                        "character": 2
                      },
                      "end": {
                        "line": 1,
                        "character": 14
                      }
                    }
                  }
                ]
              }
            },
            {
              "propName": "foo",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/types/intersection.ts",
                    "range": {
                      "start": {
                        "line": 3,
                        "character": 2
                      },
                      "end": {
                        "line": 3,
                        "character": 13
                      }
                    }
                  }
                ]
              }
            }
          ]
        `)
    })

    it('mapped type should be resolved.', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/mapped_type.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const [mappedType] = typesResult.ok
      expect(mappedType).toBeDefined()

      expect(mappedType?.type.__type).toBe('ObjectTO')
      if (!mappedType || mappedType.type.__type !== 'ObjectTO') {
        return
      }

      expect(helper.getObjectProps(mappedType.type.storeKey))
        .toMatchInlineSnapshot(`
          [
            {
              "propName": "1",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": []
              }
            },
            {
              "propName": "2",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": []
              }
            },
            {
              "propName": "3",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": []
              }
            }
          ]
        `)
    })

    it('function', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/function.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const [type0, type1, type2] = typesResult.ok
      expect(type0).toBeDefined()

      expect(type0?.type).toMatchInlineSnapshot(`
        {
          "__type": "CallableTO",
          "argTypes": [
            {
              "name": "arg",
              "type": {
                "__type": "PrimitiveTO",
                "kind": "string",
                "locations": [
                  {
                    "fileName": "./src/types/function.ts",
                    "range": {
                      "start": {
                        "line": 0,
                        "character": 20
                      },
                      "end": {
                        "line": 0,
                        "character": 31
                      }
                    }
                  }
                ]
              }
            }
          ],
          "returnType": {
            "__type": "PrimitiveTO",
            "kind": "number",
            "locations": []
          },
          "locations": [
            {
              "fileName": "./src/types/function.ts",
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 0,
                  "character": 42
                }
              }
            }
          ]
        }
      `)

      expect(type1?.type.__type).toBe('ObjectTO')
      const typeObj = type1?.type
      if (!typeObj || typeObj.__type !== 'ObjectTO') {
        return
      }

      expect(helper.getObjectProps(typeObj.storeKey)).toMatchInlineSnapshot(`
        [
          {
            "propName": "method",
            "type": {
              "__type": "CallableTO",
              "argTypes": [
                {
                  "name": "arg",
                  "type": {
                    "__type": "PrimitiveTO",
                    "kind": "string",
                    "locations": [
                      {
                        "fileName": "./src/types/function.ts",
                        "range": {
                          "start": {
                            "line": 2,
                            "character": 11
                          },
                          "end": {
                            "line": 2,
                            "character": 22
                          }
                        }
                      }
                    ]
                  }
                }
              ],
              "returnType": {
                "__type": "PrimitiveTO",
                "kind": "number",
                "locations": []
              },
              "locations": [
                {
                  "fileName": "./src/types/function.ts",
                  "range": {
                    "start": {
                      "line": 2,
                      "character": 10
                    },
                    "end": {
                      "line": 2,
                      "character": 33
                    }
                  }
                }
              ]
            }
          }
        ]
      `)

      expect(type2).not.toBeDefined()
    })

    describe('promise', () => {
      const getTypes = () => {
        const typesResult = helper.extractTypes(
          absolutePath('./src/types/promise.ts'),
        )

        if (!isOk(typesResult)) {
          throw new TypeError('Unexpected file')
        }

        const [promise, promiseLike] = typesResult.ok
        if (promise === undefined || promiseLike === undefined) {
          throw new TypeError('Unexpected file')
        }

        return { promise, promiseLike }
      }

      it('promise type should be resolved.', () => {
        const { promise } = getTypes()

        expect(promise.type.__type).toBe('PromiseTO')
        if (promise.type.__type !== 'PromiseTO') {
          return
        }

        const childType = promise.type.child
        expect(childType.__type).toBe('ObjectTO')
        if (childType.__type !== 'ObjectTO') {
          return
        }
        expect(helper.getObjectProps(childType.storeKey))
          .toMatchInlineSnapshot(`
            [
              {
                "propName": "name",
                "type": {
                  "__type": "PrimitiveTO",
                  "kind": "string",
                  "locations": [
                    {
                      "fileName": "./src/types/promise.ts",
                      "range": {
                        "start": {
                          "line": 1,
                          "character": 2
                        },
                        "end": {
                          "line": 1,
                          "character": 14
                        }
                      }
                    }
                  ]
                }
              }
            ]
          `)
      })

      it('promise-like type should be resolved.', () => {
        const { promiseLike } = getTypes()

        expect(promiseLike.type.__type).toBe('PromiseLikeTO')
        if (promiseLike.type.__type !== 'PromiseLikeTO') {
          return
        }

        const childType = promiseLike.type.child
        expect(childType.__type).toBe('ObjectTO')
        if (childType.__type !== 'ObjectTO') {
          return
        }
        expect(helper.getObjectProps(childType.storeKey))
          .toMatchInlineSnapshot(`
            [
              {
                "propName": "name",
                "type": {
                  "__type": "PrimitiveTO",
                  "kind": "string",
                  "locations": [
                    {
                      "fileName": "./src/types/promise.ts",
                      "range": {
                        "start": {
                          "line": 5,
                          "character": 2
                        },
                        "end": {
                          "line": 5,
                          "character": 14
                        }
                      }
                    }
                  ]
                }
              }
            ]
          `)
      })
    })

    it('symbol', () => {
      const typesResult = helper.extractTypes(
        absolutePath('./src/types/symbol.ts'),
      )
      expect(isOk(typesResult)).toBe(true)
      if (!isOk(typesResult)) {
        return
      }

      const types = typesResult.ok

      const [type0, type1] = types
      expect(type1).toBeDefined()

      expect(type0?.type.__type).toBe('SpecialTO')
      if (!type0 || type0.type.__type !== 'SpecialTO') {
        return
      }
      expect(type0.type.kind).toBe('unique symbol')

      expect(type1?.type.__type).toBe('SpecialTO')
      if (!type1 || type1.type.__type !== 'SpecialTO') {
        return
      }
      expect(type1.type.kind).toBe('Symbol')
    })
  })
})
