import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/cadastro",
  "/forgot-password",
  "/redefinir-senha",
  "/agendar",
  "/termos",
  "/privacidade",
  "/manutencao",
  "/sitemap.xml",
  "/robots.txt"
];

// Caminhos que NUNCA são bloqueados pelo modo manutenção: a própria página de
// manutenção, o login (para o admin conseguir entrar e desligar) e o painel
// master (super admins continuam operando o sistema durante a manutenção).
const MAINTENANCE_BYPASS = ["/manutencao", "/login", "/master"];

// Cache em memória do status de manutenção. O middleware roda por request; sem
// cache faríamos um fetch ao banco a cada navegação. TTL curto mantém a flag
// "quase em tempo real" sem martelar o banco. Best-effort: cada instância edge
// mantém o seu próprio cache.
let maintenanceCache: { value: boolean; at: number } | null = null;
const MAINTENANCE_TTL_MS = 30_000;

async function isMaintenanceOn(request: NextRequest): Promise<boolean> {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.at < MAINTENANCE_TTL_MS) {
    return maintenanceCache.value;
  }

  try {
    const url = new URL("/api/public/maintenance", request.nextUrl.origin);
    const res = await fetch(url, { headers: { "x-mw": "1" } });
    const data = (await res.json()) as { enabled?: boolean };
    const value = Boolean(data?.enabled);
    maintenanceCache = { value, at: now };
    return value;
  } catch {
    // Fail-open: nunca bloqueia o site por falha ao consultar a flag.
    return false;
  }
}

// Observação de segurança: o modelo é "deny-by-default" — qualquer rota não
// listada acima exige autenticação (ver redirect abaixo). É a única barreira
// server-side do grupo (app), cujo layout só renderiza o AppShell (client).
// Rotas públicas nascem aqui; `startsWith` cobre subcaminhos (ex.: /agendar/slug).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("marcaiflex_token")?.value;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // Modo manutenção: visitantes deslogados são levados para /manutencao. Quem
  // está logado segue normalmente (admins veem um banner no painel; o master
  // continua acessível). Login e master ficam sempre liberados.
  if (!token) {
    const bypass = MAINTENANCE_BYPASS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!bypass && (await isMaintenanceOn(request))) {
      const url = request.nextUrl.clone();
      url.pathname = "/manutencao";
      return NextResponse.redirect(url);
    }
  }

  // Raiz: usuário logado vai para o app; visitante vê a landing pública (segue
  // o fluxo abaixo até os headers de segurança, sem redirecionar para /login).
  if (pathname === "/" && token) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!token && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    token &&
    (pathname === "/login" || pathname === "/cadastro" || pathname === "/register" || pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};
