import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface VkLoginButtonProps {
  onLogin: () => void;
}

const VkLoginButton = ({ onLogin }: VkLoginButtonProps) => {
  return (
    <Card className="p-8 max-w-md mx-auto bg-white shadow-card">
      <div className="text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Добро пожаловать</h1>
          <p className="text-muted-foreground">
            Войдите с помощью ВКонтакте, чтобы продолжить
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={onLogin}
            className="w-full h-12 bg-vk-blue hover:bg-vk-blue-dark text-white font-medium transition-smooth shadow-vk"
            size="lg"
          >
            <svg
              className="w-5 h-5 mr-3"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1.01-1.49-.9-1.744-.9-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.441 0 .61.203.78.678.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.169-.407.441-.407h2.744c.373 0 .508.203.508.643v3.473c0 .373.169.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.271.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.795.78 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
            </svg>
            Войти через ВКонтакте
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Нажимая "Войти через ВКонтакте", вы соглашаетесь с условиями использования
          </p>
        </div>
      </div>
    </Card>
  );
};

export default VkLoginButton;