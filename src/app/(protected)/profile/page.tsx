import { ProfileForm } from "@/components/profile-form";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name;

  return <ProfileForm email={email} name={name} />;
}
