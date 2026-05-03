import { redirect } from "next/navigation";

// Network settings moved to Plugins > Bot Analytics
export default function NetworkSettingsPage() {
  redirect("/admin/plugins/bot-analytics");
}
