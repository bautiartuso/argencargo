// Destino del middleware para las rutas desconocidas del host de ARGENMAQ.
// notFound() hace que Next devuelva 404 de verdad y pinte app/argenmaq/not-found.js.
import { notFound } from "next/navigation";

export default function NoEncontrado() {
  notFound();
}
