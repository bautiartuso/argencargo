// Columnas que pueden leer clientes y agentes (28/10/2026). Los costos (cost_*), las notas internas
// y las comisiones de socios solo los lee el rol "staff" de la base (admin, empleado, socios GI,
// equipo ARGENMAQ). Si se agrega una columna nueva que el portal necesita, sumarla acá y darle
// SELECT a authenticated en la base (grant select (col) on tabla to authenticated).
export const COLUMNAS_SEGURAS = {
  operations: "id,operation_code,client_id,channel,status,description,ncm_code,ncm_description,declared_value_usd,total_quantity,gross_weight_kg,volumetric_weight_kg,cbm,supplier_tracking,international_tracking,international_carrier,eta,arrived_at_origin_at,dispatched_at,arrived_in_argentina_at,cleared_customs_at,delivered_at,delivery_street,delivery_floor_apt,delivery_city,delivery_province,delivery_postal_code,created_by,created_at,updated_at,total_services,shipping_to_door,shipping_cost,origin,budget_taxes,budget_flete,budget_seguro,budget_total,closed_at,collected_amount,collection_method,collection_currency,collection_exchange_rate,collection_fee_pct,collection_date,is_collected,total_anticipos,has_battery,consolidation_confirmed,consolidation_confirmed_at,created_by_agent_id,deposit_notified,deposit_notified_at,service_type,has_phones,sent_notifications,skip_review_request,tier_discount_applied_usd,tier_discount_applied,discount_applied_usd,collection_deferred,credit_applied_usd,merchandise_value_usd,budget_surcharge,items_backup_json,last_client_nudge_at,debt_applied_usd,extra_charge_usd,gi_partner_id,gi_admin_owned,budget_mode,lost_in_customs_at,lost_in_customs_reason,despacho_die_usd,despacho_estadistica_usd,despacho_desaduanaje_usd,despacho_iva_usd,delivery_public_token,delivery_choice,delivery_zone,delivery_address,delivery_cost_usd,payment_method_chosen,delivery_confirmed_at,delivery_completed_at,delivery_ready_at,delivery_coordinated_at,ri_argencargo_collects_taxes,delivery_contact,carrier_mode,hide_customs_declaration,delivery_day,delivery_slot,payment_split,cash_arrival_amount,cash_arrival_currency,delivery_group_id,bot_coord_reminder_at,bot_coord_reminder_count,bot_pay_reminder_at,bot_pay_reminder_count,ri_entrega_directa,budget_tax_detail,office_received_at,link_opened_at,link_last_opened_at,link_open_count,auto_closed_at,docs_confirmed_at,delivery_receipt_number,labels_printed_at,remito_printed_at,recibo_printed_at,legajo_visible,retenida_at,invoice_items_count",
  operation_items: "id,operation_id,description,quantity,unit_price_usd,ncm_code,length_cm,width_cm,height_cm,gross_weight_kg,notes,created_at,import_duty_rate,statistics_rate,iva_rate,documentary_expense,iva_additional_rate,iigg_rate,iibb_rate,intervention,antidumping_note,antidumping_alerted_at,package_ids",
  clients: "id,auth_user_id,first_name,last_name,whatsapp,email,tax_condition,company_name,cuit,street,floor_apt,postal_code,city,province,points_balance,is_active,created_at,updated_at,client_code,loyalty_level,loyalty_achieved_at,tier,lifetime_points_earned,tier_achieved_at,welcome_sent_at,account_balance_usd,tutorial_completed,referred_by_client_id,referral_credit_usd,marketing_purchase_notifs_sent_at,marketing_opt_out,referral_credited_at,gi_partner_id,announcement_seen,skip_review_request,dni,last_followup_at,terms_accepted_at,deposit_email_last_at,followup_status,followup_next_at",
};

// Reescribe los filtros de una consulta a /rest/v1/<tabla>: "select=*" (o sin select en un POST/PATCH
// que devuelve filas) pasa a la lista segura de esa tabla.
export function filtrosSeguros(tabla, filters = "", method = "GET") {
  const cols = COLUMNAS_SEGURAS[String(tabla).split("?")[0]];
  if (!cols) return filters;
  let f = String(filters || "");
  if (/[?&]select=\*/.test(f)) return f.replace(/([?&]select=)\*/, `$1${cols}`);
  if (method !== "GET" && method !== "DELETE" && !/[?&]select=/.test(f)) return f + (f.includes("?") ? "&" : "?") + `select=${cols}`;
  return f;
}
