import { AccountCard } from "@/components/element/account-card";

export function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Gorth profile</h1>
      <AccountCard />
    </div>
  );
}
