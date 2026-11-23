import { withRoute, ok } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { listScripts, countScripts } from "@/lib/scripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  const session = await requireLicense();
  return ok({
    scripts: listScripts(session.accountId),
    total: countScripts(session.accountId),
  });
});
