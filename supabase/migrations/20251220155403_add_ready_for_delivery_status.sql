/*
  # Add READY_FOR_DELIVERY Status

  1. Changes
    - Add READY_FOR_DELIVERY status to order_status enum
    - This status represents when an order is ready and waiting for rider pickup
  
  2. Status Flow
    - PENDING -> Order placed
    - CONFIRMED -> Payment confirmed
    - PREPARING -> Items being prepared
    - READY_FOR_DELIVERY -> Ready for rider pickup (NEW)
    - DISPATCHED -> Handed to delivery partner
    - OUT_FOR_DELIVERY -> On the way to customer
    - DELIVERED -> Successfully delivered
*/

-- Add READY_FOR_DELIVERY status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY_FOR_DELIVERY';
