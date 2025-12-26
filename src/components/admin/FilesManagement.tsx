import { useState, useEffect } from 'react';
import { Upload, Trash2, Image, FileText, HardDrive, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BusinessFile {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  file_type: string;
  created_at: string;
}

interface FilesManagementProps {
  businessId: string;
  storageLimit: number;
}

export default function FilesManagement({ businessId, storageLimit }: FilesManagementProps) {
  const [files, setFiles] = useState<BusinessFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [selectedFile, setSelectedFile] = useState<BusinessFile | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [uploadType, setUploadType] = useState<'product_image' | 'qr_code'>('product_image');

  useEffect(() => {
    loadFiles();
    loadStorageUsage();
  }, [businessId]);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('business_files')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageUsage = async () => {
    try {
      const { data, error } = await supabase.rpc('get_business_storage_usage', {
        p_business_id: businessId,
      });

      if (error) throw error;
      setStorageUsed(data || 0);
    } catch (error) {
      console.error('Error loading storage usage:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = event.target.files;
    if (!fileInput || fileInput.length === 0) return;

    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB in bytes
    const invalidFiles = Array.from(fileInput).filter(file => file.size > MAX_FILE_SIZE);

    if (invalidFiles.length > 0) {
      const fileNames = invalidFiles.map(f => f.name).join(', ');
      alert(`The following files exceed 1MB and cannot be uploaded:\n${fileNames}\n\nPlease compress or resize these images before uploading.`);
      event.target.value = '';
      return;
    }

    setUploading(true);
    const uploadedFiles: BusinessFile[] = [];

    try {
      for (const file of Array.from(fileInput)) {
        if (storageUsed + file.size / 1024 / 1024 > storageLimit) {
          alert(`Storage limit exceeded. You have ${(storageLimit - storageUsed).toFixed(2)}MB remaining.`);
          break;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const bucketName = uploadType === 'qr_code' ? 'business-qr-codes' : 'business-files';
        const folderName = uploadType === 'qr_code' ? 'qr-codes' : 'product_images';
        const filePath = uploadType === 'qr_code'
          ? `${businessId}/${fileName}`
          : `${businessId}/${folderName}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: fileRecord, error: dbError } = await supabase
          .from('business_files')
          .insert({
            business_id: businessId,
            file_name: file.name,
            storage_path: `${bucketName}/${filePath}`,
            file_size: file.size,
            mime_type: file.type,
            file_type: uploadType,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        uploadedFiles.push(fileRecord);
      }

      setFiles([...uploadedFiles, ...files]);
      await loadStorageUsage();
      event.target.value = '';
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: BusinessFile) => {
    if (!confirm(`Delete ${file.file_name}? This action cannot be undone.`)) return;

    try {
      const [bucketName, ...pathParts] = file.storage_path.split('/');
      const filePath = pathParts.join('/');

      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('business_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      setFiles(files.filter((f) => f.id !== file.id));
      await loadStorageUsage();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert('Error deleting file: ' + error.message);
    }
  };

  const getFileUrl = (storagePath: string) => {
    const [bucketName, ...pathParts] = storagePath.split('/');
    const filePath = pathParts.join('/');
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const filteredFiles = filterType === 'all'
    ? files
    : files.filter(f => f.file_type === filterType);

  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Files & Media</h2>
          <div className="flex items-center gap-3">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as 'product_image' | 'qr_code')}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="product_image">Product Image</option>
              <option value="qr_code">QR Code</option>
            </select>
            <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Files'}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileUpload}
                disabled={uploading || storageUsed >= storageLimit}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-600">
              <HardDrive className="w-5 h-5" />
              <span className="font-medium">Storage Usage</span>
            </div>
            <span className="text-sm font-medium">
              {storageUsed.toFixed(2)} MB / {storageLimit} MB
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                storagePercentage > 90
                  ? 'bg-red-600'
                  : storagePercentage > 75
                  ? 'bg-yellow-600'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
          {storagePercentage > 90 && (
            <p className="text-sm text-red-600 mt-2">
              Storage almost full! Delete unused files or upgrade your plan.
            </p>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({files.length})
          </button>
          <button
            onClick={() => setFilterType('product_image')}
            className={`px-3 py-1 rounded ${
              filterType === 'product_image'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Product Images ({files.filter(f => f.file_type === 'product_image').length})
          </button>
          <button
            onClick={() => setFilterType('qr_code')}
            className={`px-3 py-1 rounded ${
              filterType === 'qr_code'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            QR Codes ({files.filter(f => f.file_type === 'qr_code').length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading files...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm mt-1">Upload images to use in your products</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="relative group bg-gray-50 rounded-lg overflow-hidden border hover:border-blue-500 cursor-pointer"
                onClick={() => setSelectedFile(file)}
              >
                {file.mime_type.startsWith('image/') ? (
                  <img
                    src={getFileUrl(file.storage_path)}
                    alt={file.file_name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center bg-gray-200">
                    {getFileIcon(file.mime_type)}
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={file.file_name}>
                    {file.file_name}
                  </p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.file_size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">File Details</h3>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {selectedFile.mime_type.startsWith('image/') && (
                <img
                  src={getFileUrl(selectedFile.storage_path)}
                  alt={selectedFile.file_name}
                  className="w-full rounded-lg mb-4"
                />
              )}
              <div className="space-y-2">
                <div>
                  <span className="font-medium">File Name:</span>{' '}
                  <span className="text-gray-600">{selectedFile.file_name}</span>
                </div>
                <div>
                  <span className="font-medium">Size:</span>{' '}
                  <span className="text-gray-600">{formatFileSize(selectedFile.file_size)}</span>
                </div>
                <div>
                  <span className="font-medium">Type:</span>{' '}
                  <span className="text-gray-600">{selectedFile.mime_type}</span>
                </div>
                <div>
                  <span className="font-medium">Uploaded:</span>{' '}
                  <span className="text-gray-600">
                    {new Date(selectedFile.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-medium">URL:</span>{' '}
                  <input
                    type="text"
                    value={getFileUrl(selectedFile.storage_path)}
                    readOnly
                    className="w-full mt-1 px-3 py-2 border rounded text-sm"
                    onClick={(e) => e.currentTarget.select()}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    handleDeleteFile(selectedFile);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
