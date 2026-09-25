import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg font-bold">M</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">MEBS Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inventory, asset &amp; equipment management
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is restricted to authorised personnel. All activity is audited.
        </p>
      </div>
    </div>
  );
}
