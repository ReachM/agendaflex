import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Redefina sua senha de acesso ao MarcaiFlex.",
  robots: { index: false, follow: false }
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
