import { redirect } from "next/navigation";

export default function Home() {
  // Ops land on the dashboard; middleware bounces them to /login if signed out.
  redirect("/dashboard");
}
