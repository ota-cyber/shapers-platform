import { createRoot } from "react-dom/client";
import { AppProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";
import Home from "@/app/page";
import YouPage from "@/app/you/page";
import TeamPage from "@/app/team/page";
import MemberPage from "@/app/team/[id]/page";
import TasksPage from "@/app/tasks/page";
import Onboarding from "@/app/onboarding/page";
import MeetingPage from "@/app/meetings/[id]/page";
import { usePathname } from "./router";
import "@/app/globals.css";

function Routes() {
  const p = usePathname();
  const Page =
    p === "/" ? Home :
    p === "/you" ? YouPage :
    p === "/team" ? TeamPage :
    p.startsWith("/team/") ? MemberPage :
    p === "/tasks" ? TasksPage :
    p === "/onboarding" ? Onboarding :
    p.startsWith("/meetings/") ? MeetingPage :
    Home;
  return <Page key={p} />;
}

createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <Shell>
      <Routes />
    </Shell>
  </AppProvider>,
);
