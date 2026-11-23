import { ScriptWorkspace } from "@/components/script-workspace";

export const metadata = { title: "Script" };
export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScriptWorkspace scriptId={id} />;
}
