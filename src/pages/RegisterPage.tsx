import { Navigate } from "react-router-dom";

/** O cadastro agora é feito pelo checkout: escolha de plano → pagamento → acesso na hora. */
export default function RegisterPage() {
  return <Navigate to="/#planos" replace />;
}
