import { permanentRedirect } from "next/navigation";

/**
 * /cadastro foi renomeado para /register quando movemos as telas de auth para
 * o grupo (auth). Mantemos esta página apenas para redirecionar links antigos
 * (compartilhamentos, e-mails) com 308 PERMANENT REDIRECT.
 */
export default function CadastroRedirectPage(): never {
  permanentRedirect("/register");
}
