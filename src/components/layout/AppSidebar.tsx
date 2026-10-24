import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Building2, FlaskConical, HelpCircle, KeyRound, LayoutDashboard, ShieldCheck } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const explore = [
  { title: "Procedure Explorer", url: "/", icon: LayoutDashboard },
  { title: "Hospitals", url: "/hospitals", icon: Building2 },
  { title: "Data Quality", url: "/data-quality", icon: ShieldCheck },
] as const;

const learn = [
  { title: "About the Data", url: "/about", icon: BookOpen },
  { title: "Methodology", url: "/methodology", icon: FlaskConical },
  { title: "FAQ", url: "/faq", icon: HelpCircle },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const active = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const renderGroup = (label: string, items: typeof explore | typeof learn) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-[10px]">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={active(item.url)} tooltip={item.title}>
                <Link to={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-sidebar-primary/50 text-xs font-bold text-sidebar-primary">
            CB
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-serif text-lg leading-none text-sidebar-accent-foreground">ClearCost</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/55">Boston price guide</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Explore", explore)}
        {renderGroup("Learn", learn)}
        {renderGroup("Admin", [{ title: "Import CSV", url: "/admin", icon: KeyRound }] as const)}
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && (
          <div className="border-l border-sidebar-primary/70 pl-3 text-[11px] leading-relaxed text-sidebar-foreground/70">
            Compare the prices hospitals publish for common care.
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
