import { redirect } from "next/navigation";

import { EmptyWorkspace } from "@/components/empty-workspace";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTripsForUser } from "@/lib/trips/queries";

export default async function TripsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    const trips = await listTripsForUser(await getDb(), userId);
    if (trips.length > 0) {
      redirect(`/trips/${trips[0].id}`);
    }
  }

  return <EmptyWorkspace />;
}
