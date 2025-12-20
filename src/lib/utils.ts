export interface DeliveryFeeTier {
  min_amount: number;
  max_amount: number | null;
  fee: number;
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    AED: 'د.إ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    NPR: 'रू',
  };
  return symbols[currency] || currency;
}

export function formatCurrency(amount: number, currency: string = 'AED'): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
}

export function calculateDeliveryFee(
  orderAmount: number,
  deliveryFeeTiers: DeliveryFeeTier[]
): number {
  if (!deliveryFeeTiers || deliveryFeeTiers.length === 0) {
    return 0;
  }

  for (const tier of deliveryFeeTiers) {
    const isAboveMin = orderAmount >= tier.min_amount;
    const isBelowMax = tier.max_amount === null || orderAmount < tier.max_amount;

    if (isAboveMin && isBelowMax) {
      return tier.fee;
    }
  }

  return 0;
}

export function validateMinimumOrder(
  orderAmount: number,
  minimumOrderAmount: number,
  currency: string = 'AED'
): { valid: boolean; message?: string } {
  if (minimumOrderAmount > 0 && orderAmount < minimumOrderAmount) {
    return {
      valid: false,
      message: `Minimum order amount is ${formatCurrency(minimumOrderAmount, currency)}`,
    };
  }
  return { valid: true };
}
