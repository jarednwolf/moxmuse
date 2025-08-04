import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'

export const authRouter = createTRPCRouter({
  // Register a new user
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { email, password, name } = input

      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists'
        })
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create the user
      const user = await ctx.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
        } as any
      })

      return {
        success: true,
        message: 'User registered successfully',
        userId: user.id
      }
    }),

  // Get current user (for testing)
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null
    }

    return ctx.session.user
  }),

  // Debug: List all users (REMOVE IN PRODUCTION)
  debugListUsers: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })
    
    console.log('All users in database:', users)
    return users
  }),
}) 