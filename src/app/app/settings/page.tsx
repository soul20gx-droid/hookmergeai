import { SettingsPanel } from "@/components/settings-panel";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsPanel />;
}
