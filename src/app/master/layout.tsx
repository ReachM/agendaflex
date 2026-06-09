import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/security/jwt";
import { SAShell } from "@/components/master/SAShell";
import "./master.css";

export const dynamic = "force-dynamic";

type SAUser = { id: string; name: string; email: string };

async function getSuperAdmin(): Promise<SAUser | null> {
  const token = (await cookies()).get("marcaiflex_token")?.value;
  if (!token) return null;

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    return null;
  }

  if (payload.role !== "SUPER_ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { systemRole: { select: { name: true } } }
  });

  if (!user || user.status !== "ACTIVE" || user.systemRole?.name !== "SUPER_ADMIN") {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email };
}

export default async function MasterLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSuperAdmin();
  if (!user) redirect("/dashboard");

  return (
    <div data-theme="superadmin">
      <SAShell user={user}>{children}</SAShell>
    </div>
  );
}
