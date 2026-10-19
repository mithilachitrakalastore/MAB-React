alter table public.products
    add column if not exists advance_percentage numeric(5, 2) not null default 0
        check (advance_percentage >= 0 and advance_percentage <= 100);

alter table public.orders
    add column if not exists payment_type text,
    add column if not exists payment_gateway text,
    add column if not exists advance_due_amount numeric(12, 2) not null default 0,
    add column if not exists amount_paid numeric(12, 2) not null default 0;

create table if not exists public.payment_sessions (
    id uuid primary key default gen_random_uuid(),
    customer_id text not null,
    order_allocations jsonb not null,
    amount numeric(12, 2) not null check (amount > 0),
    gateway text not null check (gateway in ('esewa', 'khalti')),
    payment_type text not null check (payment_type in ('advance', 'full', 'balance')),
    status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
    provider_reference text,
    created_at timestamptz not null default now()
);

alter table public.payment_sessions enable row level security;
revoke all on table public.payment_sessions from anon, authenticated;

create or replace function public.complete_payment_session(session_id uuid, gateway_reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    payment_session public.payment_sessions%rowtype;
    allocation jsonb;
begin
    select * into payment_session
    from public.payment_sessions
    where id = session_id
    for update;

    if not found then
        raise exception 'Payment session not found.';
    end if;
    if payment_session.status = 'completed' then
        return true;
    end if;
    if payment_session.status <> 'pending' then
        raise exception 'Payment session is not pending.';
    end if;

    for allocation in select value from jsonb_array_elements(payment_session.order_allocations)
    loop
        update public.orders
        set amount_paid = least(coalesce(amount_paid, 0) + (allocation ->> 'amount')::numeric, total),
            customer_payment_status = case
                when coalesce(amount_paid, 0) + (allocation ->> 'amount')::numeric >= total then 'done'
                else 'partial'
            end,
            customer_payment_verified = coalesce(amount_paid, 0) + (allocation ->> 'amount')::numeric >= total
        where id = allocation ->> 'order_id'
          and customer_id = payment_session.customer_id
          and status <> 'cancelled';

        if not found then
            raise exception 'An order in this payment session could not be updated.';
        end if;
    end loop;

    update public.payment_sessions
    set status = 'completed', provider_reference = gateway_reference
    where id = payment_session.id;

    return true;
end;
$$;

revoke all on function public.complete_payment_session(uuid, text) from public, anon, authenticated;
