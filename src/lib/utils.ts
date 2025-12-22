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

export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  // For localhost development, check for subdomain in format: subdomain.localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // For development with subdomain (e.g., business1.localhost)
  if (hostname.endsWith('.localhost')) {
    return hostname.split('.')[0];
  }

  // For bolt.host deployments (e.g., something.bolt.host is main, business1.something.bolt.host is subdomain)
  if (hostname.endsWith('.bolt.host')) {
    const parts = hostname.split('.');
    // If exactly 3 parts (something.bolt.host), it's the main domain
    if (parts.length === 3) {
      return null;
    }
    // If 4+ parts (business1.something.bolt.host), first part is subdomain
    if (parts.length >= 4) {
      return parts[0];
    }
  }

  // For production (e.g., business1.yourdomain.com)
  const parts = hostname.split('.');

  // If hostname has 3+ parts (subdomain.domain.com), extract subdomain
  if (parts.length >= 3) {
    // Don't treat 'www' as a subdomain
    if (parts[0] === 'www') {
      return null;
    }
    return parts[0];
  }

  return null;
}

export function isMainDomain(): boolean {
  const subdomain = getSubdomain();
  return subdomain === null;
}

export function buildSubdomainUrl(subdomain: string, path: string = ''): string {
  if (typeof window === 'undefined') return '';

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // For localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const portPart = port ? `:${port}` : '';
    return `${protocol}//${subdomain}.localhost${portPart}${path}`;
  }

  // For production - replace subdomain or add it
  const currentSubdomain = getSubdomain();
  let newHostname;

  if (currentSubdomain) {
    // Replace existing subdomain
    newHostname = hostname.replace(currentSubdomain, subdomain);
  } else {
    // Add subdomain to main domain
    newHostname = `${subdomain}.${hostname}`;
  }

  const portPart = port ? `:${port}` : '';
  return `${protocol}//${newHostname}${portPart}${path}`;
}

export function validateSubdomain(subdomain: string): { valid: boolean; message?: string } {
  // Check length (3-63 characters)
  if (subdomain.length < 3 || subdomain.length > 63) {
    return {
      valid: false,
      message: 'Subdomain must be between 3 and 63 characters',
    };
  }

  // Check format: alphanumeric and hyphens, must start and end with alphanumeric
  const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
  if (!subdomainRegex.test(subdomain)) {
    return {
      valid: false,
      message: 'Subdomain can only contain lowercase letters, numbers, and hyphens (cannot start or end with hyphen)',
    };
  }

  // Reserved subdomains
  const reserved = ['www', 'admin', 'api', 'app', 'mail', 'ftp', 'localhost', 'staging', 'dev', 'test'];
  if (reserved.includes(subdomain)) {
    return {
      valid: false,
      message: 'This subdomain is reserved and cannot be used',
    };
  }

  return { valid: true };
}
