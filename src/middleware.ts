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
  "/sitemap.xml",
  "/robots.txt"
];

// Observação de segurança: o modelo é "deny-by-default" — qualquer rota não
// listada acima exige autenticação (ver redirect abaixo). É a única barreira
// server-side do grupo (app), cujo layout só renderiza o AppShell (client).
// Rotas públicas nascem aqui; `startsWith` cobre subcaminhos (ex.: /agendar/slug).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("marcaiflex_token")?.value;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

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
