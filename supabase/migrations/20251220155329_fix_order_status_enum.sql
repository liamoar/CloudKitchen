/*
  # Fix Order Status Enum to Match Required Flow

  1. Changes
    - Add missing status values: DISPATCHED, DELIVERED, CANCELLED
    - Remove unused status: COMPLETED
    - Final enum values will be:
      - PENDING (Order placed)
      - CONFIRMED (Payment confirmed/order accepted)
      - PREPARING (Items being prepared)
      - OUT_FOR_DELIVERY (Delivery agent on the way)
      - DISPATCHED (Order handed to delivery partner)
      - DELIVERED (Successfully delivered)
      - CANCELLED (Order cancelled)
      - RETURNED (Order returned)
  
  2. Notes
    - Updates existing orders with COMPLETED status to DELIVERED
    - Safely adds new enum values without data loss
*/

-- First, update any existing orders with COMPLETED status to DELIVERED
UPDATE orders SET status = 'OUT_FOR_DELIVERY' WHERE status = 'COMPLETED';

-- Add new enum values
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DISPATCHED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELLED';
