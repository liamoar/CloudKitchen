import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Truck, Store as StoreIcon, AlertCircle, Plus, Trash2, Home, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { formatCurrency, calculateDeliveryFee, validateMinimumOrder, getSubdomain, type DeliveryFeeTier } from '../../lib/utils';

interface CheckoutProps {
  onBack: () => void;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

interface CustomerAddress {
  id: string;
  label: string;
  full_address: string;
  city: string;
  postal_code: string | null;
  is_default: boolean;
}

export function Checkout({ onBack }: CheckoutProps) {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const subdomain = getSubdomain();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [trackingToken, setTrackingToken] = useState<string>('');
  const [businessId, setBusinessId] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>('COD');
  const [currency, setCurrency] = useState<string>('AED');
  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number>(0);
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<DeliveryFeeTier[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [validationError, setValidationError] = useState<string>('');

  const [step, setStep] = useState<'phone' | 'details' | 'addresses'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
    addressLabel: 'Home',
    notes: '',
  });

  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        let business;

        if (subdomain) {
          const { data, error } = await supabase
            .from('businesses')
            .select('id, countries!inner(currency_symbol)')
            .eq('subdomain', subdomain)
            .maybeSingle();

          if (error) {
            console.error('Error loading business by subdomain:', error);
            return;
          }
          business = data;
        } else {
          const { data, error } = await supabase
            .from('businesses')
            .select('id, countries!inner(currency_symbol)')
            .maybeSingle();

          if (error) {
            console.error('Error loading business:', error);
            return;
          }
          business = data;
        }

        if (business) {
          setBusinessId(business.id);
          setCurrency(business.countries?.currency_symbol || 'USD');

          const { data: settings } = await supabase
            .from('business_settings')
            .select('minimum_order_value, delivery_charges')
            .eq('business_id', business.id)
            .maybeSingle();

          if (settings) {
            setMinimumOrderAmount(settings.minimum_order_value || 0);
            setDeliveryFee(settings.delivery_charges || 0);
          }
        }
      } catch (error) {
        console.error('Error in loadRestaurant:', error);
      }
    };

    loadRestaurant();
  }, [subdomain]);

  useEffect(() => {
    const validation = validateMinimumOrder(total, minimumOrderAmount, currency);
    if (!validation.valid) {
      setValidationError(validation.message || '');
    } else {
      setValidationError('');
    }
  }, [total, minimumOrderAmount, currency]);

  const lookupCustomer = async (phone: string) => {
    if (!phone || phone.length < 8 || !businessId) {
      alert('Please enter a valid phone number (at least 8 digits)');
      return;
    }

    setCheckingCustomer(true);
    try {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('phone', phone)
        .maybeSingle();

      if (existingCustomer) {
        setCustomer(existingCustomer);
        setFormData(prev => ({
          ...prev,
          name: existingCustomer.name,
          email: existingCustomer.email || '',
        }));

        const { data: customerAddresses } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', existingCustomer.id)
          .order('is_default', { ascending: false });

        if (customerAddresses && customerAddresses.length > 0) {
          setAddresses(customerAddresses);
          const defaultAddress = customerAddresses.find(a => a.is_default) || customerAddresses[0];
          setSelectedAddressId(defaultAddress.id);
          setStep('details');
        } else {
          setStep('details');
        }
      } else {
        setCustomer(null);
        setAddresses([]);
        setStep('details');
      }
    } catch (error) {
      console.error('Error looking up customer:', error);
      alert('Failed to verify phone number. Please try again.');
    } finally {
      setCheckingCustomer(false);
    }
  };

  const saveNewAddress = async (customerId: string) => {
    if (addresses.length >= 2) {
      alert('Maximum 2 addresses allowed per customer');
      return;
    }

    const { data: newAddress, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: customerId,
        label: formData.addressLabel,
        full_address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode || null,
        is_default: addresses.length === 0,
      })
      .select()
      .single();

    if (error) throw error;
    return newAddress;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = validateMinimumOrder(total, minimumOrderAmount, currency);
      if (!validation.valid) {
        alert(validation.message);
        return;
      }

      let customerId = customer?.id;
      let customerAddressId: string | null = null;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            business_id: businessId,
            phone: phoneNumber,
            name: formData.name,
            email: formData.email || null,
          })
          .select()
          .single();

        if (customerError || !newCustomer) throw new Error('Failed to create customer');
        customerId = newCustomer.id;

        if (deliveryType === 'DELIVERY') {
          const newAddress = await saveNewAddress(customerId);
          customerAddressId = newAddress.id;
        }
      } else {
        if (customer.name !== formData.name || customer.email !== formData.email) {
          await supabase
            .from('customers')
            .update({
              name: formData.name,
              email: formData.email || null,
            })
            .eq('id', customerId);
        }

        if (deliveryType === 'DELIVERY') {
          if (selectedAddressId) {
            customerAddressId = selectedAddressId;
          } else if (showNewAddress && formData.address && formData.city) {
            const newAddress = await saveNewAddress(customerId);
            customerAddressId = newAddress.id;
          }
        }
      }

      const finalDeliveryFee = deliveryType === 'DELIVERY' ? deliveryFee : 0;
      const finalTotal = total + finalDeliveryFee;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          customer_address_id: customerAddressId,
          business_id: businessId,
          total_amount: finalTotal,
          delivery_fee: finalDeliveryFee,
          status: 'pending',
          payment_method: paymentMethod.toLowerCase(),
          is_self_pickup: deliveryType === 'PICKUP',
          payment_confirmed: false,
          delivery_notes: formData.notes || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError || !order) throw new Error('Failed to create order');

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_sku: null,
        product_variant_details: null,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw new Error('Failed to create order items');

      const tokenValue = `${order.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await supabase.from('order_tracking_tokens').insert({
        token: tokenValue,
        order_id: order.id,
        token_type: 'CUSTOMER',
        expires_at: expiresAt.toISOString(),
      });

      setOrderId(order.id);
      setTrackingToken(tokenValue);
      setOrderPlaced(true);
      clearCart();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    const trackingUrl = `${window.location.origin}/track/${trackingToken}`;

    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-600 mb-4">Your order ID is: #{orderId.slice(0, 8).toUpperCase()}</p>

        {deliveryType === 'PICKUP' ? (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <StoreIcon className="mx-auto text-blue-600 mb-2" size={32} />
            <p className="text-gray-700 font-medium mb-1">Self Pickup</p>
            <p className="text-sm text-gray-600">
              We'll call you at {phoneNumber} when your order is ready for pickup.
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <Truck className="mx-auto text-blue-600 mb-2" size={32} />
            <p className="text-gray-700 font-medium mb-1">Home Delivery</p>
            <p className="text-sm text-gray-600">
              We'll call you at {phoneNumber} to confirm your order and delivery details.
            </p>
          </div>
        )}

        {paymentMethod === 'BANK_TRANSFER' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 font-medium mb-2">Bank Transfer Selected</p>
            <p className="text-xs text-yellow-700">
              Please complete the bank transfer and the restaurant will confirm your payment.
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 font-medium mb-2">Track Your Order</p>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm underline break-all"
          >
            {trackingUrl}
          </a>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Order More
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold text-gray-800">Checkout</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your phone number"
              />
            </div>
            {checkingCustomer && (
              <div className="text-sm text-gray-600 text-center py-2">
                Checking if you're a returning customer...
              </div>
            )}
            <button
              type="button"
              onClick={() => lookupCustomer(phoneNumber)}
              disabled={checkingCustomer || !phoneNumber || phoneNumber.length < 8}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400"
            >
              {checkingCustomer ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        )}

        {step === 'details' && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  disabled
                  value={phoneNumber}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Delivery Type *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeliveryType('DELIVERY')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'DELIVERY'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck className={`mx-auto mb-2 ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
                  <p className={`font-medium ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-700'}`}>
                    Home Delivery
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('PICKUP')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'PICKUP'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <StoreIcon className={`mx-auto mb-2 ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
                  <p className={`font-medium ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-700'}`}>
                    Self Pickup
                  </p>
                </button>
              </div>
            </div>

            {deliveryType === 'DELIVERY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Label
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Home', 'Work', 'Other'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFormData({ ...formData, addressLabel: label })}
                        className={`py-2 px-4 rounded-lg border transition-all ${
                          formData.addressLabel === label
                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Street, Building, Landmark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-medium ${paymentMethod === 'COD' ? 'text-green-600' : 'text-gray-700'}`}>
                      Cash on Delivery
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Pay when you receive</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-medium ${paymentMethod === 'BANK_TRANSFER' ? 'text-blue-600' : 'text-gray-700'}`}>
                      Bank Transfer
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Transfer before delivery</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Notes / Special Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., Ring the doorbell, Leave at door, Call on arrival..."
              />
            </div>
          </>
        )}

        {step === 'addresses' && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  disabled
                  value={phoneNumber}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Delivery Type *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeliveryType('DELIVERY')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'DELIVERY'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck className={`mx-auto mb-2 ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
                  <p className={`font-medium ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-700'}`}>
                    Home Delivery
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('PICKUP')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    deliveryType === 'PICKUP'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <StoreIcon className={`mx-auto mb-2 ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
                  <p className={`font-medium ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-700'}`}>
                    Self Pickup
                  </p>
                </button>
              </div>
            </div>

            {deliveryType === 'DELIVERY' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Delivery Address *
                </label>
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(addr.id);
                        setShowNewAddress(false);
                      }}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedAddressId === addr.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {addr.label === 'Home' && <Home size={16} className="text-gray-600" />}
                          {addr.label === 'Work' && <Briefcase size={16} className="text-gray-600" />}
                          <span className="font-medium text-gray-900">{addr.label}</span>
                          {addr.is_default && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{addr.full_address}</p>
                      <p className="text-sm text-gray-500">{addr.city}</p>
                    </button>
                  ))}

                  {addresses.length < 2 && !showNewAddress && (
                    <button
                      type="button"
                      onClick={() => setShowNewAddress(true)}
                      className="w-full p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-orange-600"
                    >
                      <Plus size={20} />
                      <span>Add New Address</span>
                    </button>
                  )}

                  {showNewAddress && (
                    <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">New Address</h4>
                        <button
                          type="button"
                          onClick={() => setShowNewAddress(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Label
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Home', 'Work', 'Other'].map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setFormData({ ...formData, addressLabel: label })}
                              className={`py-2 px-4 rounded-lg border transition-all ${
                                formData.addressLabel === label
                                  ? 'border-orange-500 bg-white text-orange-600'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Delivery Address *
                        </label>
                        <input
                          type="text"
                          required={showNewAddress}
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Street, Building, Landmark"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            required={showNewAddress}
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Postal Code
                          </label>
                          <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-medium ${paymentMethod === 'COD' ? 'text-green-600' : 'text-gray-700'}`}>
                      Cash on Delivery
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Pay when you receive</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-medium ${paymentMethod === 'BANK_TRANSFER' ? 'text-blue-600' : 'text-gray-700'}`}>
                      Bank Transfer
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Transfer before delivery</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Notes / Special Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., Ring the doorbell, Leave at door, Call on arrival..."
              />
            </div>
          </>
        )}

        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-900 font-semibold text-sm">{validationError}</p>
              <p className="text-red-700 text-xs mt-1">
                Add more items to your cart to proceed with checkout.
              </p>
            </div>
          </div>
        )}

        {step !== 'phone' && (
          <div className="pt-4 border-t">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(total, currency)}</span>
              </div>
              {deliveryType === 'DELIVERY' && deliveryFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Delivery Fee</span>
                  <span className="font-medium text-gray-900">{formatCurrency(deliveryFee, currency)}</span>
                </div>
              )}
              {deliveryType === 'DELIVERY' && deliveryFee === 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Delivery Fee</span>
                  <span className="font-medium text-green-600">FREE</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-lg font-semibold text-gray-800">Total</span>
                <span className="text-2xl font-bold text-orange-600">
                  {formatCurrency(total + (deliveryType === 'DELIVERY' ? deliveryFee : 0), currency)}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !!validationError}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
