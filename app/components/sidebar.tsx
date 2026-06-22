import { ChartNoAxesColumn, CircleHelp, FolderOpen, MessageSquareText, Settings, type LucideIcon } from "lucide-react";
import { SidebarItem } from "@/app/components/ui";
import type { ViewKey } from "@/app/types";

const navigationItems: Array<{
  label: string;
  icon: LucideIcon;
  view?: ViewKey;
}> = [
  { label: "Knowledge", icon: FolderOpen, view: "ingestion" },
  { label: "Chat", icon: MessageSquareText, view: "chat" },
  { label: "Analytics", icon: ChartNoAxesColumn },
];

export function Sidebar({
  activeView,
  onSelectView,
}: {
  activeView: ViewKey;
  onSelectView: (view: ViewKey) => void;
}) {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-line bg-sidebar px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-1">
        <div className="flex size-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white">
          R
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-5 text-ink">RAG Engine</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {navigationItems.map((item) => (
          <SidebarItem
            key={item.label}
            active={item.view === activeView}
            icon={item.icon}
            label={item.label}
            onClick={() => item.view && onSelectView(item.view)}
          />
        ))}
      </nav>

      <div className="mt-auto border-t border-line pt-3">
        <SidebarItem icon={Settings} label="Settings" />
        <SidebarItem icon={CircleHelp} label="Help" />
      </div>
    </aside>
  );
}
