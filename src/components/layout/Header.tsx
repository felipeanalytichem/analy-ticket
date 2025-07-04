import { Bell, Menu, Search, Settings, User, LogOut, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export function Header({ title = "Dashboard", showSearch = true, onSearch }: HeaderProps) {
  const { userProfile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "transition-all duration-200"
    )}>
      <div className="container flex h-14 md:h-16 items-center px-4 md:px-6">
        {/* Mobile: Sidebar trigger and logo */}
        <div className="flex items-center gap-2 md:gap-4">
          <SidebarTrigger className={cn(
            "md:hidden",
            "h-9 w-9", // Larger touch target for mobile
            "hover:bg-accent/80 transition-colors"
          )} />
          
          {/* Mobile logo - only show when not searching */}
          {isMobile && !isSearchFocused && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Ticket className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm">ACS</span>
            </div>
          )}
        </div>

        {/* Desktop: Page title */}
        {!isMobile && (
          <div className="flex-1 px-6">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
        )}

        {/* Search bar */}
        {showSearch && (
          <div className={cn(
            "flex-1 max-w-sm mx-4",
            isMobile && "max-w-none mx-2",
            isSearchFocused && isMobile && "flex-1"
          )}>
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder={isMobile ? "Search..." : "Search tickets, users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={cn(
                  "pl-10 pr-4",
                  isMobile && "h-9 text-base", // Larger on mobile to prevent zoom
                  "transition-all duration-200",
                  isSearchFocused && "ring-2 ring-ring"
                )}
              />
            </form>
          </div>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Theme toggle - hidden on mobile when searching */}
          {(!isMobile || !isSearchFocused) && (
            <ThemeToggle />
          )}

          {/* Language switcher - hidden on mobile */}
          {!isMobile && <LanguageSwitcher />}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "relative h-9 w-9 rounded-full",
                  "hover:bg-accent/80 transition-colors"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-xs">
                    {userProfile ? getInitials(userProfile.full_name || userProfile.email) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className={cn(
                "w-56",
                isMobile && "w-64" // Wider on mobile for better touch targets
              )} 
              align="end" 
              forceMount
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userProfile?.full_name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userProfile?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {userProfile?.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => navigate('/profile')}
                className={cn(
                  "cursor-pointer",
                  isMobile && "h-12" // Larger touch targets on mobile
                )}
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className={cn(
                  "cursor-pointer",
                  isMobile && "h-12"
                )}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>

              {/* Mobile-only: Language switcher */}
              {isMobile && (
                <DropdownMenuItem className="h-12 p-0">
                  <div className="flex items-center w-full px-2">
                    <LanguageSwitcher />
                  </div>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={handleSignOut}
                className={cn(
                  "cursor-pointer text-red-600 dark:text-red-400",
                  isMobile && "h-12"
                )}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
} 