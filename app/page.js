import { redirect } from "next/navigation";

export default function Home() {
  redirect("/order?dept=hr");
}