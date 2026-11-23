import { AiConfigPanel } from "@/components/ai-config-panel";

export const metadata = { title: "AI configuration" };
export const dynamic = "force-dynamic";

export default function AiConfigPage() {
  return <AiConfigPanel />;
}
