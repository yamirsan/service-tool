import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import API from '../config';

const Upload = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const uploadMutation = useMutation(
    (formData) => axios.post(`${API}/upload-excel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
    {
      onSuccess: (response) => {
        setUploadResult(response.data);
        queryClient.invalidateQueries('parts');
        queryClient.invalidateQueries('formulas');
        toast.success('Excel file uploaded successfully!');
        setFile(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to upload file');
      }
    }
  );

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
      } else {
        toast.error('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
      } else {
        toast.error('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 mb-4">
              <UploadIcon className="h-6 w-6 text-primary-600" />
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent">Excel Data Sync</h1>
            <p className="mt-2 text-gray-700">Upload Excel files to update parts and formulas data</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="px-4 sm:px-0">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100 p-6">
            {!uploadResult ? (
              <>
                {/* File Upload Area */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 ${
                    dragActive
                      ? 'border-primary-400 bg-primary-50'
                      : file
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    {file ? (
                      <div className="space-y-4">
                        <FileSpreadsheet className="mx-auto h-12 w-12 text-green-600" />
                        <div>
                          <p className="text-lg font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <div className="flex justify-center space-x-4">
                          <button
                            onClick={handleUpload}
                            disabled={uploadMutation.isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                          >
                            {uploadMutation.isLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <UploadIcon className="h-4 w-4 mr-2" />
                                Upload File
                              </>
                            )}
                          </button>
                          <button
                            onClick={resetUpload}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <div>
                          <p className="text-lg font-medium text-gray-900">
                            Drop your Excel file here
                          </p>
                          <p className="text-sm text-gray-500">
                            or click to browse files
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileSelect}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* File Format Information */}
                <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-900 mb-2">Expected Excel Format</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                    <div>
                      <h4 className="font-medium mb-2">Parts Sheet (Sheet 1):</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Code (Part Number)</li>
                        <li>Description</li>
                        <li>MAP Price</li>
                        <li>Net Price</li>
                        <li>Status (Active/Dead)</li>
                        <li>S.QTY (Stock Quantity)</li>
                        <li>GR QTY</li>
                        <li>GR $ (GR USD)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Formulas Sheet (Optional):</h4>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Class (Formula Name)</li>
                        <li>Labor Lvl2</li>
                        <li>Labor Lvl3</li>
                        <li>Exchange Rate</li>
                        <li>Final Price (Optional)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Upload Results */
              <div className="text-center space-y-6">
                <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Upload Successful!</h3>
                  <p className="mt-2 text-gray-600">{uploadResult.message}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {uploadResult.parts_imported}
                    </div>
                    <div className="text-sm text-green-800">Parts Imported</div>
                  </div>
                  {uploadResult.formulas_imported > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {uploadResult.formulas_imported}
                      </div>
                      <div className="text-sm text-blue-800">Formulas Imported</div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center space-x-4">
                  <button
                    onClick={resetUpload}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Upload Another File
                  </button>
                  <button
                    onClick={() => window.location.href = '/parts'}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    View Parts
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Tips */}
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <h4 className="font-medium mb-1">Upload Tips:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ensure your Excel file has the correct column headers</li>
                  <li>Existing parts will be updated with new data</li>
                  <li>New parts will be created automatically</li>
                  <li>The system supports both .xlsx and .xls formats</li>
                  <li>Maximum file size: 10MB</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
