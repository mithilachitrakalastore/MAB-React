# Mithila-Chitrakala-Store--React

## Product inventory

Run [`supabase/migrations/20261010000000_product_stock_on_orders.sql`](./supabase/migrations/20261010000000_product_stock_on_orders.sql) in the Supabase SQL Editor to install the order inventory trigger. New orders atomically reduce product stock, insufficient-stock orders are rejected, and cancelling an order restores its stock. After installing the migration, successful checkouts refresh the storefront's product data.

## Advance and full payments

Run [`supabase/migrations/20261011000000_advance_payments.sql`](./supabase/migrations/20261011000000_advance_payments.sql) after the inventory migration. Sellers can set an advance percentage on each product; customers can then pay that advance or the full order amount using eSewa or Khalti. Any outstanding amount is available from the customer's profile dashboard.

eSewa uses its official sandbox product code and UAT signing key automatically outside production. For production, configure gateway credentials on the server only:

- In production, set `ESEWA_PRODUCT_CODE` (or the existing `PRODUCT_CODE`) and `ESEWA_SECRET_KEY`; `ESEWA_BASE_URL` defaults to the eSewa test host `https://rc-epay.esewa.com.np`. `ESEWA_PRODUCT_CODE` takes precedence when both product-code variables are set.
- `KHALTI_SECRET_KEY` from Khalti's test merchant portal; `KHALTI_BASE_URL` defaults to the Khalti sandbox API `https://a.khalti.com/api/v2`.
- Set `PUBLIC_FRONTEND_URL` to the public site URL so gateway returns reach the correct application. If the API is hosted on a different origin, also set `PUBLIC_API_URL` to the API server's public origin for gateway callbacks.

This feature defaults to test/sandbox gateways. Use live merchant credentials and set `ESEWA_BASE_URL` / `KHALTI_BASE_URL` to the providers' production API hosts only after gateway onboarding. Never expose gateway secrets through `VITE_` variables.