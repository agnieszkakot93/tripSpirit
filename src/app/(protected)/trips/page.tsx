import { EmptyWorkspace, WorkspacePlaceholder } from "@/components/empty-workspace";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTripsForUser } from "@/lib/trips/queries";

export default async function TripsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <EmptyWorkspace />;
  }

  const trips = await listTripsForUser(await getDb(), userId);

  if (trips.length === 0) {
    return <EmptyWorkspace />;
  }

  return <WorkspacePlaceholder />;
}
