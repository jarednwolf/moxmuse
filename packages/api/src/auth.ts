import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@moxmuse/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    }),
    // Google OAuth (optional, requires setup)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          })
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (account?.provider === "google" && user?.email) {
          // Create or update user for OAuth sign-ins
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name,
              image: user.image,
            },
            create: {
              email: user.email,
              name: user.name,
              image: user.image,
            },
          });
        }
        return true;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return true; // Allow sign in even if database operation fails
      }
    },
    async jwt({ token, user }) {
      try {
        if (user?.id) {
          token.id = user.id;
        }
        return token || {};
      } catch (error) {
        console.error("JWT callback error:", error);
        return token || {};
      }
    },
    async session({ session, token }) {
      try {
        // Ensure session object exists
        if (!session) {
          return { user: {}, expires: "" };
        }
        
        if (session?.user?.email) {
          // Get the user from database to ensure we have the correct ID
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
          });
          
          if (dbUser) {
            session.user.id = dbUser.id;
          } else if (token?.id) {
            session.user.id = token.id as string;
          }
        }
        
        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        // Return minimal valid session object
        return session || { user: {}, expires: "" };
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  logger: {
    error: (code, metadata) => {
      console.error("NextAuth Error:", code, metadata);
    },
    warn: (code) => {
      console.warn("NextAuth Warning:", code);
    },
    debug: (code, metadata) => {
      // Suppress debug logs in production
      if (process.env.NODE_ENV !== 'production') {
        console.debug("NextAuth Debug:", code, metadata);
      }
    },
  },
  // Disable client-side logging to prevent _log endpoint calls
  events: {},
}; 