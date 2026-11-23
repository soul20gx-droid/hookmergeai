import { ScriptsLibrary } from "@/components/scripts-library";

export const metadata = { title: "My scripts" };
export const dynamic = "force-dynamic";

export default function ScriptsPage() {
  return <ScriptsLibrary />;
}
