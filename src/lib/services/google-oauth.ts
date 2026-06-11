// Google OAuth 2.0 — implementação direta sobre as APIs nativas do Google
// (sem NextAuth nem dependências extras). Fluxo: authorization code + userinfo.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

function getEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** Gera a URL de autorização do Google. */
export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/** Troca o authorization code por tokens. */
export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return res.json() as Promise<{ access_token: string; id_token: string }>;
}

/** Busca o perfil do usuário com o access_token. */
export async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) throw new Error("Falha ao buscar perfil do Google.");

  const data = (await res.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!data.email_verified) {
    throw new Error("E-mail do Google não verificado.");
  }

  return data;
}
