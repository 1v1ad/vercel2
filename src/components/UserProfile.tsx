import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface UserProfileProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    photo?: string;
  };
  onLogout: () => void;
}

const UserProfile = ({ user, onLogout }: UserProfileProps) => {
  return (
    <header className="bg-white border-b shadow-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="w-12 h-12 border-2 border-primary/20">
              <AvatarImage 
                src={user.photo} 
                alt={`${user.firstName} ${user.lastName}`}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                {user.firstName[0]}{user.lastName[0]}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h2 className="font-semibold text-foreground">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">ID: {user.id}</p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={onLogout}
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default UserProfile;