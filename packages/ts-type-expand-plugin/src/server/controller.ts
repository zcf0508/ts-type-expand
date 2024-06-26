import { TRPCError } from '@trpc/server'
import { serializeTypeObject } from 'compiler-api-helper'
import { z } from 'zod'
import type { CompilerHandler } from '../service/compiler-api-handler.js'
import { logger } from '../logger.js'
import { procedure, requiredProgramProcedure } from './procedure.js'
import { t } from './trpc.js'

export const isServerActivated = procedure.query(() => ({
  success: true,
  data: {
    isActivated: true,
  },
}))

export const getTypeFromPos = requiredProgramProcedure
  .input(
    z.object({
      filePath: z.string(),
      line: z.number(),
      character: z.number(),
    }),
  )
  .query(({ input, ctx }) => {
    try {
      const { filePath, line, character } = input
      const compilerHandler: CompilerHandler = ctx.compilerHandler

      const maybeType = compilerHandler.getTypeFromLineAndCharacter(
        filePath,
        line,
        character,
      )

      if (!maybeType) {
        logger.error('MAYBE_TYPE_IS_NOT_DEFINED', {})
        throw new TRPCError({
          message: 'maybeType is not defined',
          code: 'INTERNAL_SERVER_ERROR',
        })
      }

      const [declareName, typeObject] = maybeType

      return {
        declareName,
        type: serializeTypeObject(typeObject),
        // | to.PrimitiveTO
        // | to.LiteralTO
        // | to.SpecialTO
        // // | to.ArrayTO
        // // | to.TupleTO
        // // | to.UnionTO,
        // | to.EnumTO
        // // | to.CallableTO
        // // | to.PromiseTO
        // | to.UnsupportedTO
        // | to.ObjectTO,
      }
    } catch (err) {
      if (err instanceof Error) {
        logger.error('UNEXPECTED_GET_TYPE_ERROR', {
          name: err.name,
          message: err.message,
          stack: err.stack,
        })

        throw new TRPCError({
          message: `error: ${err.toString()}`,
          code: 'INTERNAL_SERVER_ERROR',
        })
      }

      throw new TRPCError({
        message: 'Unexpected',
        code: 'INTERNAL_SERVER_ERROR',
      })
    }
  })

export const getObjectProps = requiredProgramProcedure
  .input(
    z.object({
      storeKey: z.string(),
    }),
  )
  .query(({ input, ctx }) => {
    try {
      const { storeKey } = input
      const compilerHandler: CompilerHandler = ctx.compilerHandler

      const props = compilerHandler.getObjectProps(storeKey)
      return props.map(({ propName, type }) => ({
        propName,
        type: serializeTypeObject(type),
      }))
    } catch (err) {
      logger.error('UNEXPECTED_GET_TYPE_ERROR', err as Record<string, unknown>)

      if (err instanceof Error) {
        throw new TRPCError({
          message: `error: ${err.toString()}`,
          code: 'INTERNAL_SERVER_ERROR',
        })
      }

      throw new TRPCError({
        message: 'Unexpected',
        code: 'INTERNAL_SERVER_ERROR',
      })
    }
  })

export const router = t.router({
  isServerActivated,
  getTypeFromPos,
  getObjectProps,
})

export type AppRouter = typeof router
