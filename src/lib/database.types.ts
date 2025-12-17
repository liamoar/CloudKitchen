export type UserRole = 'SUPER_ADMIN' | 'RESTRO_OWNER' | 'CUSTOMER';
export type OfferType = 'FLAT' | 'PERCENT';
export type OfferApplicable = 'PRODUCT' | 'BUNDLE' | 'CART';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'COMPLETED';
export type OrderItemType = 'PRODUCT' | 'BUNDLE';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email: string | null;
  password: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  address_line: string;
  city: string;
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  fixed_price: number;
  is_active: boolean;
  created_at: string;
}

export interface BundleProduct {
  id: string;
  bundle_id: string;
  product_id: string;
  quantity: number;
}

export interface Offer {
  id: string;
  name: string;
  type: OfferType;
  value: number;
  applicable_to: OfferApplicable;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  phone_number: string;
  delivery_address: string;
  total_amount: number;
  discount_applied: number;
  status: OrderStatus;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_type: OrderItemType;
  item_id: string;
  item_name: string;
  quantity: number;
  price: number;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at'>;
        Update: Partial<Omit<Address, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at'>>;
      };
      bundles: {
        Row: Bundle;
        Insert: Omit<Bundle, 'id' | 'created_at'>;
        Update: Partial<Omit<Bundle, 'id' | 'created_at'>>;
      };
      bundle_products: {
        Row: BundleProduct;
        Insert: Omit<BundleProduct, 'id'>;
        Update: Partial<Omit<BundleProduct, 'id'>>;
      };
      offers: {
        Row: Offer;
        Insert: Omit<Offer, 'id' | 'created_at'>;
        Update: Partial<Omit<Offer, 'id' | 'created_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at'>;
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id'>;
        Update: Partial<Omit<OrderItem, 'id'>>;
      };
    };
  };
}
