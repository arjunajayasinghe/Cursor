"use client";

import { ModuleListPage } from "@/components/module-list-page";
import { MODULE_UI } from "@/lib/modules";

export default function VesselPage() {
  return <ModuleListPage def={MODULE_UI.vessel} />;
}
