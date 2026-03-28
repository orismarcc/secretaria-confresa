import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Página não encontrada</p>
        <Button onClick={() => navigate("/")}>Voltar ao início</Button>
      </div>
    </div>
  );
};

export default NotFound;
