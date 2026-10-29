import { redirect } from "next/navigation";

export default function CalendarRedirectPage() {
  redirect("/tasks?view=calendar");
}
