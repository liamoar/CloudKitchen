import React, { useState, useEffect } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SubscriptionTier {
  id: string;
  name: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  features: any;
}

interface PaymentSubmissionProps {
  restaurantId: string;
  currentTier?: SubscriptionTier;
  country: string;
  currency: string;
  transactionType: 'upgrade' | 'renewal';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PaymentSubmission({
  restaurantId,
  currentTier,
  country,
  currency,
  transactionType,
  onSuccess,
  onCancel,
}: PaymentSubmissionProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTiers();
  }, [country]);

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('country', country)
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      setTiers(data || []);

      if (transactionType === 'renewal' && currentTier) {
        setSelectedTierId(currentTier.id);
      }
    } catch (err: any) {
      setError('Failed to load subscription tiers');
      console.error(err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTierId) {
      setError('Please select a subscription tier');
      return;
    }

    if (!imageFile) {
      setError('Please upload payment proof');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Upload image to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${restaurantId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(fileName);

      const selectedTier = tiers.find(t => t.id === selectedTierId);
      if (!selectedTier) throw new Error('Selected tier not found');

      // Create payment receipt record
      const { error: insertError } = await supabase
        .from('payment_receipts')
        .insert({
          restaurant_id: restaurantId,
          subscription_tier_id: selectedTierId,
          previous_tier_id: currentTier?.id || null,
          transaction_type: transactionType,
          amount: selectedTier.monthly_price,
          currency: currency,
          receipt_image_url: urlData.publicUrl,
          notes: notes,
          status: 'PENDING',
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {transactionType === 'upgrade' ? 'Upgrade Subscription' : 'Renew Subscription'}
            </h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tier Selection */}
            {transactionType === 'upgrade' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Subscription Tier
                </label>
                <div className="space-y-3">
                  {tiers.map((tier) => (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedTierId === tier.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-lg">{tier.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {tier.product_limit === -1 ? 'Unlimited' : tier.product_limit} products • {' '}
                            {tier.order_limit_per_month === -1 ? 'Unlimited' : tier.order_limit_per_month} orders/month
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {currency} {tier.monthly_price}
                          </div>
                          <div className="text-sm text-gray-500">per month</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Renewal Info */}
            {transactionType === 'renewal' && currentTier && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-2">{currentTier.name} Plan</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {currency} {currentTier.monthly_price}
                </p>
                <p className="text-sm text-gray-600 mt-1">Monthly renewal payment</p>
              </div>
            )}

            {/* Amount Summary */}
            {selectedTier && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount to Pay:</span>
                  <span className="text-2xl font-bold">
                    {currency} {selectedTier.monthly_price}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Proof Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Payment Proof *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {!imagePreview ? (
                  <label className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      Click to upload payment screenshot or receipt
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Payment proof"
                      className="max-h-64 mx-auto rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information about the payment..."
              />
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">Payment Instructions:</h4>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Make the payment to the account details provided by our team</li>
                <li>Take a screenshot or photo of the payment confirmation</li>
                <li>Upload the image above and submit</li>
                <li>Your payment will be reviewed within 24 hours</li>
                <li>You'll be notified once approved</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !selectedTierId || !imageFile}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
