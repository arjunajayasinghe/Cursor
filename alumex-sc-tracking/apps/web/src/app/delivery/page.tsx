"use client";

import { ModuleListPage } from "@/components/module-list-page";
import { MODULE_UI } from "@/lib/modules";

export default function DeliveryPage() {
  return <ModuleListPage def={MODULE_UI.delivery} />;
}
