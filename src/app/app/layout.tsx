import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { getSession } from "@/lib/auth";
import { licenseToView } from "@/lib/license";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/verify");

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="lg:flex">
        <AppSidebar license={licenseToView(session.license)} />
        <main className="min-w-0 flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
