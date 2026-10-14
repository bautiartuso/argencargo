-- Kairo · topes por porcentaje (14/10/2026)
--
-- El tope de una categoría puede ser un monto fijo (monthly_limit) o un % de lo que ingresa en el
-- mes (limit_pct). Si tiene %, manda el %: el tope en pesos se recalcula solo cuando cambian los
-- ingresos.

alter table mp_expense_categories add column if not exists limit_pct numeric;
