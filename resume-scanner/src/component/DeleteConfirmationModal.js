// src/component/DeleteConfirmationModal.js
import React from 'react';

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-brown-light animate-fade-in">
                <h3 className="text-lg font-semibold text-brown mb-2">Delete Resume</h3>
                <p className="text-brown-light mb-4">
                    Are you sure you want to delete "{title}"? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-cream-light text-brown border border-brown rounded-lg hover:bg-cream transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}