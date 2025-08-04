import NextAuth from "next-auth";
import { authOptions } from "@moxmuse/api/src/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 