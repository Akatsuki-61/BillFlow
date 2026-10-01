import { redirect } from "next/navigation";

export default function TodoRedirectPage() {
  redirect("/tasks");
}
