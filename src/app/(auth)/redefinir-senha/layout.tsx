import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false }
};

export default function RedefinirSenhaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
