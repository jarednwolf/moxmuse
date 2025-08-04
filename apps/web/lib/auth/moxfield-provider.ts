import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth"

export interface MoxfieldProfile {
  id: string
  username: string
  email: string
  avatar?: string
}

export default function MoxfieldProvider<P extends MoxfieldProfile>(
  options: OAuthUserConfig<P>
): OAuthConfig<P> {
  return {
    id: "moxfield",
    name: "Moxfield",
    type: "oauth",
    version: "2.0",
    authorization: {
      url: "https://www.moxfield.com/oauth/authorize",
      params: {
        scope: "read:collection write:collection",
      },
    },
    token: "https://www.moxfield.com/oauth/token",
    userinfo: "https://api2.moxfield.com/v1/user",
    client: {
      id: options.clientId,
      secret: options.clientSecret,
    },
    profile(profile: P) {
      return {
        id: profile.id,
        name: profile.username,
        email: profile.email,
        image: profile.avatar,
      }
    },
    style: {
      logo: "https://www.moxfield.com/favicon.ico",
      logoDark: "https://www.moxfield.com/favicon.ico",
      bg: "#1a1a1a",
      text: "#fff",
      bgDark: "#1a1a1a",
      textDark: "#fff",
    },
    options,
  }
} 