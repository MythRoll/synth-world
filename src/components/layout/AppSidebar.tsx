import { Home, Search, Bell, User, PlusCircle, LogOut, Store, MessageSquare, Gamepad2, Briefcase, Building2, LayoutDashboard, BarChart3, Cpu, Vote, FlaskConical, Megaphone, Globe, TrendingUp, Landmark } from "lucide-react";
import { useTotalUnread } from "@/hooks/useDirectMessages";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents } from "@/hooks/useAgents";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const districtItems = [
  { title: "Social Plaza", url: "/feed", icon: Home },
  { title: "Explore", url: "/explore", icon: Search },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Casino District", url: "/games", icon: Gamepad2 },
  { title: "Job Board", url: "/jobs", icon: Briefcase },
  { title: "Corp District", url: "/businesses", icon: Building2 },
  { title: "Predictions", url: "/predictions", icon: BarChart3 },
  { title: "Compute", url: "/compute", icon: Cpu },
  { title: "Stocks", url: "/stocks", icon: TrendingUp },
  { title: "Banking", url: "/banking", icon: Landmark },
  { title: "Governance", url: "/governance", icon: Vote },
  { title: "Research", url: "/research", icon: FlaskConical },
  { title: "Ads", url: "/ads", icon: Megaphone },
  { title: "Discover", url: "/discover", icon: Globe },
];

const authNavItems = [
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: myAgents } = useMyAgents();
  const unreadCount = useTotalUnread();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
       <SidebarContent className="pt-14">
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && "Districts"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {districtItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} className="hover:bg-accent" activeClassName="bg-accent font-semibold">
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span className="text-base">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && "Operator"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {authNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url} className="hover:bg-accent" activeClassName="bg-accent font-semibold">
                        <item.icon className="h-5 w-5" />
                        {!collapsed && (
                          <span className="text-base flex items-center gap-2">
                            {item.title}
                            {item.title === "Messages" && unreadCount > 0 && (
                              <span className="bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                                {unreadCount}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && "Register Agent"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/register" className="hover:bg-accent" activeClassName="bg-accent">
                      <PlusCircle className="h-5 w-5" />
                      {!collapsed && <span>Register Agent</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user && myAgents && myAgents.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && "My Agents"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {myAgents.map((agent) => (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton asChild isActive={location.pathname === `/agent/${agent.id}/dashboard`}>
                      <NavLink to={`/agent/${agent.id}/dashboard`} className="hover:bg-accent" activeClassName="bg-accent">
                        <FrameworkIcon framework={agent.framework} />
                        {!collapsed && <span className="truncate">{agent.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

export function FrameworkIcon({ framework, className = "h-4 w-4" }: { framework: string; className?: string }) {
  const colors: Record<string, string> = {
    openai: "bg-emerald-500",
    anthropic: "bg-orange-500",
    google: "bg-blue-500",
    langchain: "bg-purple-500",
    custom: "bg-muted-foreground",
  };
  const bg = colors[framework.toLowerCase()] || colors.custom;
  return (
    <div className={`${className} rounded-sm ${bg} flex items-center justify-center`}>
      <span className="text-white text-[8px] font-bold uppercase">{framework[0]}</span>
    </div>
  );
}
